# Story

1. opencv.js is able to be used, but loading net takes long time, and it will be inconvenient to load net every time when user open the page. 

2. So I decided to use Node.js and opencv4nodejs so the net will be available anytime once the model is loaded in when server starts.
  - see: **How to use Opencv in js - opencv4nodejs**

3. opencv4nodejs vs opencv.js ?
Problem:
  - opencv4nodejs: Functions in Mat (such as getData(), getDataAsArray() ) doesn't handle 4-dims data (up to 3-dims). Some names of attributes and functions are different from the original OpenCV. (Need to check API: https://justadudewhohacks.github.io/opencv4nodejs/docs/Mat#Mat)

  - opencv.js: Need to have some hussle preparation before actually using cv modules in Node.js. Quite a lot of important functions hasn't been covoerd (such as imdecode()).

  - This time I chose `opencv4nodejs` for Node.js.





# Tesseract.js
https://github.com/naptha/tesseract.js#tesseractjs
```
  $ npm install tesseract.js --save
```



# How to use Opencv.js 

1. Get OpenCV **3.x.x** source from:
  - https://opencv.org/releases/  ---> i.e. `opencv-3.4.9`


2. Install **Emcripten** into somewhere:
**REF:** https://docs.opencv.org/master/d4/da1/tutorial_js_setup.html

```
$ git clone https://github.com/emscripten-core/emsdk.git
$ cd emsdk
$ ./emsdk update
$ ./emsdk install latest
$ ./emsdk activate latest
$ source ./emsdk_env.sh
```

3. Build OpenCV.js from source obtained in 1.

  - Go to opencv repo: `opencv-3.4.9`
  - Build WebAssembly version of opencv.js:
    ```
    $ python ./platforms/js/build_js.py build_wasm --build_wasm
    ```

4. Put opencv.js created in 3. in this repository:
```
$ cp ~/install/opencv-3.4.9/build_wasm/bin/opencv.js .
```

5. Copy util.js from opencv repository (use `Utils.createFileFromUrl()`):
```
$ cp ~/install/opencv-3.4.9/doc/js_tutorials/js_assets/utils.js .
```


# Other tutorials and things I tried

## How to use Opencv in js - opencv4nodejs

### Install opencv4nodejs

0. (optional)if you don't want to install opencv itself, first set the environment variable as following:
```
# linux and osx:
export OPENCV4NODEJS_DISABLE_AUTOBUILD=1
```

1. In the project root directory:
```
(when installing packages for the first time)
$ npm init

$ npm install --save opencv4nodejs
```

2. If `package.json` exists (when deploy this project):
```
$ npm install
```

**REF:** https://github.com/justadudewhohacks/opencv4nodejs#how-to-install


### OpenCv.js with Node.js
opencv4nodejs: https://github.com/justadudewhohacks/opencv4nodejs

### EAST text detection in JS
https://github.com/justadudewhohacks/opencv4nodejs/blob/master/examples/EASTTextDetection.js


### For Node.js
**REF**
- https://nodejs.org/en/
- Routing : expressJS (https://expressjs.com/)
- HTTPS connection: https://nodejs.org/en/knowledge/HTTP/servers/how-to-create-a-HTTPS-server/ & https://stackoverflow.com/questions/11744975/enabling-https-on-express-js


## How to use TensorFlow.js and frozen model in JS

### Tutorial

GitHUB: https://github.com/tensorflow/tfjs/tree/master/tfjs-converter/demo/mobilenet

1. Add TensorFlow.js into HTML
```
<script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@1.0.0/dist/tf.min.js"></script>
```

**REF:** https://www.tensorflow.org/js/tutorials/setup

2. install yarn

3. Transform frozen model file into web model file
https://www.tensorflow.org/js/tutorials/conversion/import_saved_model




## How to use OpenCV.js (ver 3.4)

**NOTE: This doesn't look like containing dnn module. so can't use for DNN model ...**


**REF:** https://www.youtube.com/watch?v=uO7k5aBJwk4

1. Download opencv.js
https://docs.opencv.org/3.4/opencv.js

2. Set in <script>
```
<script async src="opencv.js" onload="onOpenCvReady();" type="text/javascript"></script>
```

If you want to build opencv.js from source:

- Build OpenCV.js: https://docs.opencv.org/3.4/d4/da1/tutorial_js_setup.html
- Install Emscripten : https://webassembly.org/getting-started/developers-guide/




# Apache2 install
## Apache2
- https://www.digitalocean.com/community/tutorials/how-to-move-an-apache-web-root-to-a-new-location-on-ubuntu-16-04
- https://ubuntu.com/tutorials/install-and-configure-apache#1-overview

**NOTE**: Just rewrote `/etc/apache2/sites-enabled/000-default.conf`.
```
DocumentRoot /var/www/textreaderjs
```

## HTTPS setting
- https://www.digitalocean.com/community/tutorials/how-to-create-a-self-signed-ssl-certificate-for-apache-in-ubuntu-18-04

