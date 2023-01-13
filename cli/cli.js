#!/usr/bin/env node
import { program } from 'commander';
import { basename } from 'node:path';
import { createReadStream } from 'node:fs';
import { stat } from 'fs/promises';
import { request } from 'undici';

const BASE_URL = 'https://linktransfer.click/share/'

program
    .name('linktransfer')
    .description('Link Transfer cli tool for file transfer')
    .addHelpText('after', `
To upload a file from the local directory, use:

$ weshare <FILENAME>
    `)
    .argument('<filepath>', 'Path to the file to upload') 
    .action (async function (filepath) {
        try {
            //make sure file exists
            const stats = await stat(filepath)
            if (!stats.isFile()) {
                throw new Error(`${filepath} is not a file`)
            }
            const filename = basename(filepath);
            //put filename to query param
            const shareUrl = new URL(BASE_URL);
            shareUrl.searchParams.append('filename', filename);

            //make the request to generate presigned urls
            const shareUrlRes = await request(shareUrl, {
                method: 'POST',
                headers: {
                    'accept': 'application/json',
                    'user-agent': 'linktransfer.click cli'
                }
            });
            if (shareUrlRes.statusCode !== 201) {
                const responseBody = await shareUrlRes.body.text()
                throw new Error(`unexpected pre-upload response code ${shareUrlRes.statusCode}\n${responseBody}`);
            }
            const shareUrlResBody = await shareUrlRes.body.json();
            //read file through stream
            const fileStream = createReadStream(filepath);

            //upload and the file with presigned URL
            const uploadRes = await request(shareUrlResBody.uploadUrl, {
                method: 'PUT',
                headers: {
                    'content-type': 'application/octet-stream',
                    'content-length': stats.size,
                    ...shareUrlResBody.headers
                },
                body: fileStream
            })

            if (uploadRes.statusCode !== 200) {
                const responseBody = await shareUrlRes.body.text()
                throw new Error(`unexpected upload response  code ${shareUrlRes.statusCode}\n${responseBody}`);
            }
            console.log(`Uploaded successfully!\nHere is the download URL: ${shareUrlResBody.downloadUrl}`)


        } catch (err) {
            console.error(err);
            process.exit(1);
        }
        })
    .parse()