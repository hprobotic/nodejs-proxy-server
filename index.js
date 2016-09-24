let http = require('http')
let request = require('request')
let through = require('through')
let fs = require('fs')
let argv = require('yargs')
    .default('host', '127.0.0.1')
    .argv
let scheme = 'http://'
let port = argv.port || argv.host === '127.0.0.1' ? 8000 : 80
let destinationUrl = argv.url || scheme  + argv.host + ':' + port
let outputStream = argv.logFile ? fs.createWriteStream(argv.logFile) : process.stdout

// Proxy server
http.createServer((req, res) => {
	let url = destinationUrl
	if (req.headers['x-destination-url']) {
		url = req.headers['x-destination-url']
  }
	let options = {
		headers: req.headers,
		url: url + req.url
	}
	outputStream.write("\nPing: \n" + JSON.stringify(req.headers))
	through(req, outputStream, {autoDestroy: false});
	let destinationResponse = req.pipe(request(options))
	outputStream.write("\ndestination.headers ---" + JSON.stringify(destinationResponse.headers))
	destinationResponse.pipe(res)
	through(destinationResponse, outputStream, {autoDestroy: false})

}).listen(8001)

// Request Server
http.createServer((req, res) => {
	outputStream.write("\nPong: \n" + JSON.stringify(req.headers));
	for (let header in req.headers) {
	    res.setHeader(header, req.headers[header])
	}
	 outputStream.write('\n' + JSON.stringify(req.headers))
	 through(req, outputStream, {autoDestroy: false});
	 req.pipe(res)
}).listen(8000)
