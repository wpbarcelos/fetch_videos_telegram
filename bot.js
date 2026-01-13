const { TelegramClient } = require('telegram')
const { StringSession } = require('telegram/sessions')
const input = require('input')
const fs = require('fs')
const path = require('path')
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
        requestRetries: 5,
        requestTimeout: 60 // 60 segundos de timeout
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
    console.log(`Obtendo entidade do chat: ${chatId}`)
    const entity = await client.getEntity(chatId);
    console.log(`Entidade obtida: ${entity}`)

    fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
    let count = 0;
    let messageCount = 0;

    console.log("Iterando mensagens...")
    for await (const message of client.iterMessages(entity, { reverse: true })) {
        messageCount++;
        console.log(`\n[Mensagem #${messageCount}] ID: ${message.id}`)

        if (message.text) {
            console.log('  Texto:', message.text.substring(0, 50))
        }

        if (message.media) {
            console.log('  Tem mídia: SIM')
            console.log('  Tipo de mídia:', message.media.constructor.name)

            // Debug completo
            console.log('  Media object:', JSON.stringify({
                hasDocument: !!message.media.document,
                docMimeType: message.media.document?.mimeType,
                docSize: message.media.document?.size,
                className: message.media.constructor.name
            }))

            // Verificar se é um vídeo
            if (message.media.document) {
                const doc = message.media.document;
                const mimeType = doc.mimeType || '';

                console.log(`  MIME Type: ${mimeType}`)
                console.log(`  Tamanho: ${doc.size} bytes`)

                const isVideo = mimeType.startsWith('video') ||
                    mimeType.includes('video');

                if (isVideo) {
                    console.log('  ✓ É um vídeo!')

                    let filename = `video_${message.id}.mp4`;

                    if (doc.attributes && Array.isArray(doc.attributes)) {
                        for (let attr of doc.attributes) {
                            if (attr.fileName) {
                                filename = attr.fileName;
                                console.log(`  Nome extraído: ${filename}`)
                                break;
                            }
                        }
                    }

                    const filepath = path.join(DOWNLOAD_DIR, filename);

                    if (fs.existsSync(filepath)) {
                        console.log(`  ✓ Arquivo já existe: ${filename}`)
                        continue
                    }

                    console.log(`  ⬇ Iniciando download: ${filename}`)
                    try {
                        const fileSize = doc.size || 0;

                        console.log(`  Chamando downloadMedia...`)

                        let lastProgress = 0;
                        let lastLog = Date.now();

                        // Tentar download com a mensagem
                        const result = await client.downloadMedia(message, {
                            outputFile: filepath,
                            progressCallback: (downloaded, total) => {
                                const now = Date.now();
                                // Log a cada 2 segundos
                                if (now - lastLog > 2000) {
                                    const percent = Math.round((downloaded / total) * 100);
                                    const mbDownloaded = (downloaded / 1024 / 1024).toFixed(2);
                                    const mbTotal = (total / 1024 / 1024).toFixed(2);
                                    console.log(`  ↳ ${percent}% (${mbDownloaded}MB / ${mbTotal}MB)`);
                                    lastLog = now;
                                }
                            }
                        });

                        console.log(`  ✓ Download concluído!`)
                        console.log(`  Arquivo salvo em: ${filepath}`)
                        count++;

                    } catch (err) {
                        console.error(`  ✗ Erro ao baixar:`, err.message)
                        console.error(`  Stack:`, err.stack)
                    }
                } else {
                    console.log(`  ✗ Não é vídeo (MIME: ${mimeType})`)
                }
            } else {
                console.log('  ✗ Sem documento')
            }
        } else {
            console.log('  Sem mídia')
        }

        // Limitar a 10 mensagens para teste
        if (messageCount >= 10) {
            console.log('\nLimite de teste atingido (10 mensagens)')
            break;
        }
    }

    console.log(`\n✓ Total baixado: ${count} vídeos`)
    console.log(`✓ Total de mensagens verificadas: ${messageCount}`)
    await client.disconnect();
}

main().catch(err => console.error('Erro principal:', err.stack));