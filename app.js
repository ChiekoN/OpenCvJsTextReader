'use strict';

const https = require('https'); // for HTTPS
const fs = require('fs');
const path = require('path');
const express = require('express');
const app = express();
const router = express.Router();
const bodyParser = require('body-parser');

const td = require('./static/textdetection');

const PORT = 5000;

/* To create an https server:
    https://nodejs.org/en/knowledge/HTTP/servers/how-to-create-a-HTTPS-server/

 $ openssl genrsa -out key.pem
 $ openssl req -new -key key.pem -out csr.pem
 $ openssl x509 -req -days 9999 -in csr.pem -signkey key.pem -out cert.pem
 $ rm csr.pem
*/


app.use(express.json( {limit: '50mb'} ));
app.use(express.urlencoded({ limit: '50mb', extended: true}));

//
// TODO: Add router.get(), router.post()
//

router.get('/', function(req, res) {
    console.log('Got request for root');

    res.sendFile(path.join(__dirname, 'index.html'), function (err) {
        if (err) throw err;
        console.log("index.html sent.");
    });
});

router.post('/canvas', function (req, res) {
    let imgString = JSON.stringify(req.body.image);
    //console.log("img :" + imgString);
    let imgBuffer = imgString.split(',')[1];
    let buff = Buffer.from(imgBuffer, 'base64');
    fs.writeFileSync('capturedImage.png', buff);
    
    // Text Detection
    td.detect(buff)
    .then( function(resultList){
        res.send(resultList);
        console.log("Image saved and response sent!");
    });

});


app.use(express.static('static'));
app.use('/', router);

const options = {
    key: fs.readFileSync('key.pem'),
    cert: fs.readFileSync('cert.pem')
};

const httpsServer = https.createServer(options, app);
httpsServer.listen(PORT);

console.log("Started!")
