const { TelegramClient } = require('telegram')
const { StringSession } = require('telegram/sessions')
const input = require('input')
const fs = require('fs')
const { execSync } = require('child_process')

const apiId = 35140954;
const apiHash = "b6c50c2af67c4ae2daace397a8840f0a";

const SESSION_FILE = "session.txt";
const URLS_FILE = "video_urls.txt";
const ARIA2_FILE = "download.txt";
const DOWNLOAD_DIR = "videos";

const stringSession = new StringSession("")
if (fs.existsSync(SESSION_FILE)) {
    stringSession.load(fs.readFileSync(SESSION_FILE, 'utf-8'));
}

async function main() {
    console.log("Loading interactive...")
    const client = new TelegramClient(stringSession, apiId, apiHash, {
        requestRetries: 10,
        connectionRetries: 10,
        retryDelay: 1000,
        timeout: 60000
    })

    const sessionExists = fs.existsSync(SESSION_FILE);

    if (!sessionExists) {
        console.log('First login required...')
        await client.start({
            phoneNumber: '+5527999447975',
            password: async () => await input.text("Please enter your password: "),
            phoneCode: async () =>
                await input.text("Please enter the code you received: "),
            onError: (err) => console.log(err),
        });

        fs.writeFileSync(SESSION_FILE, client.session.save())
        console.log('Session saved!')
    } else {
        console.log('Using saved session...')
        await client.connect();
    }

    console.log('connected')

    const chatId = -1001610585369;
    const entity = await client.getEntity(chatId);

    fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

    let urls = [];
    let count = 0;

    for await (const message of client.iterMessages(entity, { reverse: true })) {
        if (message.text) {
            console.log('text:', message.text.substring(0, 50) + '...')
        }

        if (message.media) {
            const media = message.media;

            if (media.document && media.document.mimeType.startsWith('video')) {
                let filename = 'video_' + message.id + '.mp4';

                if (media.document.attributes) {
                    for (let attr of media.document.attributes) {
                        if (attr.fileName) {
                            filename = attr.fileName;
                            break;
                        }
                    }
                }

                try {
                    const url = `https://t.me/c/${entity.id}/${message.id}`;

                    console.log(`Video ${count + 1}: ${filename}`);
                    console.log(`URL: ${url}`);
                    console.log(`Size: ${(media.document.size / (1024 * 1024)).toFixed(2)} MB\n`);

                    urls.push({
                        filename: filename,
                        url: url,
                        size: media.document.size,
                        messageId: message.id
                    });

                    count++;
                } catch (err) {
                    console.error('Error processing video:', err.message)
                }
            }
        }
    }

    // Salvar URLs em arquivo
    if (urls.length > 0) {
        let fileContent = `# Telegram Video URLs\n`;
        fileContent += `# Gerado em: ${new Date().toLocaleString()}\n`;
        fileContent += `# Total de vídeos: ${urls.length}\n\n`;

        urls.forEach((item, index) => {
            fileContent += `## Vídeo ${index + 1}\n`;
            fileContent += `Filename: ${item.filename}\n`;
            fileContent += `Size: ${(item.size / (1024 * 1024)).toFixed(2)} MB\n`;
            fileContent += `Message ID: ${item.messageId}\n`;
            fileContent += `URL: ${item.url}\n`;
            fileContent += `\n`;
        });

        fs.writeFileSync(URLS_FILE, fileContent);
        console.log(`✓ URLs salvas em ${URLS_FILE}`);
    }

    // Criar arquivo para aria2
    let aria2Content = '';
    urls.forEach((item) => {
        aria2Content += `${item.url}\n`;
        aria2Content += ` out=${item.filename}\n`;
        aria2Content += ` dir=${DOWNLOAD_DIR}\n`;
        aria2Content += `\n`;
    });

    if (aria2Content) {
        fs.writeFileSync(ARIA2_FILE, aria2Content);
        console.log(`✓ Arquivo aria2 criado: ${ARIA2_FILE}`);
        console.log(`\n📥 Para fazer download com aria2, execute:\n`);
        console.log(`  aria2c -i ${ARIA2_FILE} -x 5 -k 1M --max-concurrent-downloads=2\n`);
        console.log(`Ou com wget:\n`);
        urls.forEach((item) => {
            console.log(`  wget "${item.url}" -O "${DOWNLOAD_DIR}/${item.filename}"\n`);
        });
    }

    console.log(`\nTotal de vídeos encontrados: ${count}`)
}

main().catch(err => console.error('Main error:', err));