const { TelegramClient } = require('telegram')
const { StringSession } = require('telegram/sessions')
const input = require('input')
const fs = require('fs')
const cliProgress = require('cli-progress')

const apiId = 35140954;
const apiHash = "b6c50c2af67c4ae2daace397a8840f0a";

const SESSION_FILE = "session.txt";
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

    await client.start({
        phoneNumber: '+5527999447975',
        password: async () => await input.text("Please enter your password: "),
        phoneCode: async () =>
            await input.text("Please enter the code you received: "),
        onError: (err) => console.log(err),
    });

    fs.writeFileSync(SESSION_FILE, client.session.save())

    console.log('connected')

    const chatId = -1001610585369;
    const entity = await client.getEntity(chatId);

    fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
    let count = 0;

    for await (const message of client.iterMessages(entity, { reverse: true })) {
        if (message.text) {
            console.log('text', message.text)
        }

        if (message.media) {
            const media = message.media;
            console.log('media type:', media.constructor.name)

            // Verificar se é um vídeo
            if (media.document && media.document.mimeType.startsWith('video')) {
                let filename = 'video_' + message.id + '.mp4';

                // Tentar extrair o nome do arquivo se disponível
                if (media.document.attributes) {
                    for (let attr of media.document.attributes) {
                        if (attr.fileName) {
                            filename = attr.fileName;
                            break;
                        }
                    }
                }

                const filepath = `${DOWNLOAD_DIR}/${filename}`;

                if (fs.existsSync(filepath)) {
                    console.log('file already exists!')
                    continue
                }

                console.log('Downloading', filename)
                try {
                    const progressBar = new cliProgress.SingleBar({
                        format: 'Progress |{bar}| {percentage}% || {value}/{total} bytes',
                        barCompleteChar: '\u2588',
                        barIncompleteChar: '\u2591',
                        hideCursor: true,
                        stopOnComplete: true
                    });

                    const fileSize = media.document.size;
                    progressBar.start(fileSize, 0);

                    await client.downloadMedia(media, {
                        outputFile: filepath,
                        progressCallback: (downloaded, total) => {
                            progressBar.update(downloaded);
                        }
                    });

                    console.log(`Downloaded ${filepath}`);
                    count++;
                } catch (err) {
                    console.error('Error downloading file:', err.message)
                }
            }
        }
    }

    console.log(`Total downloaded: ${count}`)
}

main().catch(err => console.error('Main error:', err));