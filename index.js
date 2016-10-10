"use strict"
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"
let https = require('https')
let http = require('http')
let request = require('request')
let through = require('through')
let fs = require('fs')
let argv = require('yargs')
    .default('host', '127.0.0.1')
    .usage('Usage: node ./index.js [options]')
    .alias('x', 'host')
    .describe('x', 'Specify a forwarding host')
    .default('host', '127.0.0.1')
    .alias('p', 'port')
    .describe('p', 'Specify a forwarding port')
    .alias('l', 'log')
    .describe('l', 'Specify a output log file')
    .alias('u', 'url')
    .describe('u', 'Specify a full URL')
    .help('h')
    .alias('h', 'help')
    .example('node index.js -h google.com', "Send request via Proxy to google.com")
    .describe('port_ssl', 'Start proxy server as https and listen in specific port')
    .describe('exec', 'Process forwarding')
    .epilog('copyright 2016 JohnP')
    .argv
let scheme = 'http://'
let exec = require('child_process').exec
let chalk = require('chalk')
let stream = require('stream')
let port = argv.port || argv.host === '127.0.0.1' ? 8000 : 80
let destinationUrl = argv.url || scheme + argv.host + ':' + port
let outputStream = argv.logFile ? fs.createWriteStream(argv.logFile) : process.stdout

let optionsSSL = {
    key: fs.readFileSync('key.pem'),
    cert: fs.readFileSync('cert.pem')
}

let secLogLevel = {
    0: "EMERG",
    1: "ALERT",
    2: "CRIT",
    3: "ERR",
    4: "WARNING",
    5: "NOTICE",
    6: "INFO",
    7: "DEBUG",
}

function log(level, msg, streamObj) {
    if (typeof msg === 'string' && !(streamObj instanceof stream.Stream)) {
        console.log(`[${chalk.yellow(secLogLevel[level])}] ${chalk.green(msg)}`);
    } else if (typeof msg === 'string' && (streamObj instanceof stream.Stream)) {
        streamObj.write(`\n\n[${Date.now()}]:[${secLogLevel[level]}] ${msg}`)
    }
}

if (argv.exec !== undefined) {
    exec(argv.exec, (error, stdout, stderr) => {
        console.log(chalk.green(stdout))
        console.log(chalk.red(stderr))
        if (error !== null) {
            console.log('Exec error: ${error}')
        }
    })
} else {
    // Proxy server
    // HTTPS
    if (argv.port_ssl != undefined) {
        https.createServer(optionsSSL, (req, res) => {
            let url = destinationUrl
            if (req.headers['x-destination-url']) {
                url = req.headers['x-destination-url']
            }
            let options = {
                headers: req.headers,
                url: url + req.url
            }

            log(7, `Proxying request to: ${destinationUrl + req.url}`)
            options.method = req.method
            let downStreamResponse = req.pipe(request(options))
            destinationUrl = url
            log(6, 'Proxy request:', outputStream)
            downStreamResponse.pipe(res)
        }).listen(argv.port_ssl)
    } else {
        http.createServer((req, res) => {
            let url = destinationUrl
            if (req.headers['x-destination-url']) {
                url = req.headers['x-destination-url']
            }
            let options = {
                headers: req.headers,
                url: url + req.url
            }

            log(7, `Proxying request to: ${destinationUrl + req.url}`)
            options.method = req.method
            options.method = req.method
            let downStreamResponse = req.pipe(request(options))
            destinationUrl = url
            log(6, `Proxy request:`, outputStream)
            log(6, JSON.stringify(downStreamResponse.headers), outputStream)
            downStreamResponse.pipe(res)

        }).listen(8001)
    }

    // Echo Server
    http.createServer((req, res) => {
        log(7, `Request received at: ${req.url}`)
        for (let header in req.headers) {
            res.setHeader(header, req.headers[header])
        }
        log(6, 'Echo request:', outputStream)
        log(6, JSON.stringify(req.headers), outputStream)
        through(req, outputStream, {autoDestroy: false});
        req.pipe(res)
    }).listen(8000)
}