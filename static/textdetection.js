const path = require('path');
const cv = require('opencv4nodejs');
const Flatten = require('@flatten-js/core');
const BooleanOp = require('@flatten-js/boolean-op');
const mathjs = require('mathjs');

const { createWorker } = require('tesseract.js');

const INPUTSIZE = 512;
const CONF_TH = 0.1;
const NMS_TH = 0.4;

// Read DNN model
let modelPath = path.resolve(__dirname, '../frozen_model/frozen_east_text_detection.pb');
let net = cv.readNetFromTensorflow(modelPath);
console.log("Model has been loaded!");

// Tesseract
async function getTextFromImage( image, rects ) {
    const worker = createWorker();

    await worker.load();
    await worker.loadLanguage('eng');
    await worker.initialize('eng');

    let results = [];
    for(let i = 0; i < rects.length; i++){
        const rct = {
            left: rects[i].x,
            top: rects[i].y,
            width: rects[i].width,
            height: rects[i].height
        };        
        const { data: { text } } = await worker.recognize(image, {rectangle: rct });
        console.log("text = " + text);
        results.push(text);
    }
    await worker.terminate()

    return results;
}

function decode(scores, geometry, scoreTh=0.1) {
    const [numRows, numCols] = scores.sizes.slice(2); // (1, 1, 128(=numRows), 128(=numCols))
    const boxes = [];

    for(let y = 0; y < numRows; y++) {
        for(let x = 0; x < numCols; x++) {
            const score = scores.at([0, 0, y, x]);
            if(score < scoreTh) {
                continue;
            }

            // origin should be (x,y) => index is multiplied by 4 (128 * 4 = 512)
            const offsetX = x*4;
            const offsetY = y*4;
            const top = geometry.at([0, 0, y, x]);
            const right = geometry.at([0, 1, y, x]);
            const bottom = geometry.at([0, 2, y, x]);
            const left = geometry.at([0, 3, y, x]);
            const angle = geometry.at([0, 4, y, x]);
            let coordx, coordy;

            if(angle >= 0) {
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);

                // These are the offsets from bottom-left.
                coordx = [
                    -(top + bottom) * sin, // top-left
                    ((right + left) * cos) - ((top + bottom) * sin), // top-right
                    (right + left) * cos, // bottom-right
                    0, // bottom-left
                    (left * cos) - (bottom * sin) // xy position
                ];

                coordy = [
                    -(top + bottom) * cos,
                    -((right + left) * sin) - ((top + bottom) * cos),
                    -((right + left) * sin),
                    0,
                    -(left * sin) -(bottom * cos)
                ];

 
            } else { // angle < 0

                const cos = Math.cos(-angle);
                const sin = Math.sin(-angle);

                coordx = [
                    -((left + right) * cos) + ((top + bottom) * sin),
                    (top + bottom) * sin,
                    0,
                    -(left + right) * cos,
                    -(right * cos) + (bottom * sin) 
                ];

                coordy = [
                    -((left + right) * sin) - ((top + bottom) * cos),
                    -(top + bottom) * cos,
                    0,
                    -(left + right) * sin,
                    -(right * sin) - (bottom * cos)
                ];
            }

            const originX = offsetX - coordx[4];
            const originY = offsetY - coordy[4];
            boxes.push([coordx[0] + originX, coordy[0] + originY,
                        coordx[1] + originX, coordy[1] + originY,
                        coordx[2] + originX, coordy[2] + originY,
                        coordx[3] + originX, coordy[3] + originY,
                        score
                    ]);
        }
    }
    return boxes;

}

function intersection(g, p) {
    const gReshape = mathjs.reshape(g.slice(0, -1), [4, 2]);
    const pReshape = mathjs.reshape(p.slice(0, -1), [4, 2]);

    const gPoly = new Flatten.Polygon(gReshape);
    const pPoly = new Flatten.Polygon(pReshape);

    if(!gPoly.isValid() || !pPoly.isValid()) {
        return 0;
    }

    const inter = BooleanOp.intersect(gPoly, pPoly).area();
    const union = gPoly.area() + pPoly.area() - inter;
    if(union == 0) {
        return 0;
    } else {
        return inter/union;
    }
}


function weightedMerge(poly, prevPoly) {
/* poly, prevPoly: array[].size = 9 */
    const polyGeo = poly.slice(0, -1);
    const prevPolyGeo = prevPoly.slice(0, -1);
    const polyScore = mathjs.number(poly[8]);
    const prevPolyScore = mathjs.number(prevPoly[8]);

    const polyMul = mathjs.multiply(polyScore, polyGeo);
    const prevPolyMul = mathjs.multiply(prevPolyScore, prevPolyGeo);
    const addMuls = mathjs.add(polyMul, prevPolyMul);
    const addScores = polyScore + prevPolyScore;

    let mergedPoly = mathjs.divide(addMuls, addScores);
    mergedPoly.push(addScores);

    return mergedPoly;
}

function standardNMS(polys, thres) {
    // Sort polys in descending order
    let order = polys.sort(function(a, b) { return b[8] - a[8] });
    let keep = [];

    while(order.length > 0) {

        let cur = order[0];
        keep.push(cur);
        let remains = [];

        for(let i = 1; i < order.length; i++){
            if(intersection(cur, order[i]) <= thres) {
                remains.push(order[i]);
            }
        }
        //console.log(" remains : " + remains);
        order = remains;
    }
    return keep;
}

function lanms(polys, thres=0.3) {
/* polys :  N*9
 *          [0][1] top-left(x,y), [2][3] top-right(x,y),
 *          [4][5] bottom-right(x,y), [6][7] bottom-left(x,y)
 *          [8] score
 */

    let S = [];
    let prevPoly = null;

    for(let i = 0; i < polys.length; i++) {
        if(prevPoly != null  && intersection(polys[i], prevPoly) > thres) {
            prevPoly = weightedMerge(polys[i], prevPoly);
        } else {
            if(prevPoly != null) {
                S.push(prevPoly);
            }
            prevPoly = polys[i];
        }
    }

    if(prevPoly != null){
        S.push(prevPoly);
    }
    //console.log(" S : " + S);

    if(S.length == 0) {
        return [];
    } else {
        return standardNMS(S, thres);
    }
}

exports.detect = async function (imageBytes) {

    let imageArr = new Uint8Array(imageBytes);
    //console.log("ImageBytes = " + imageArr);
    let imageMat = cv.imdecode(imageArr, cv.IMREAD_COLOR);
    //console.log("imageMat = " + imageMat + ", DIMS = " + imageMat.dims);
    const [imgH, imgW] = imageMat.sizes;
    console.log("imageMat (H, W) = (" + imgH + ", " + imgW + ")");

    const ratioH = imgH / INPUTSIZE;
    const ratioW = imgW / INPUTSIZE;
    console.log("image ratioH = " + ratioH + ", ratioW = " + ratioW);

    const inputBlob = cv.blobFromImage(imageMat, 1, new cv.Size(INPUTSIZE, INPUTSIZE),
                            new cv.Vec3(123.68, 116.78, 103.94), true, false);
   
    net.setInput(inputBlob);

    const outBlobNames = [  'feature_fusion/Conv_7/Sigmoid',
                            'feature_fusion/concat_3',
                         ];
    
    
    const [scores, geometry] = net.forward(outBlobNames); // Return = Mat

    console.log(" --- network got output! ---");
    console.log(" scores.sizes = " + scores.sizes);
    console.log(" geometry.sizes = " + geometry.sizes);

    boxes = decode(scores, geometry, CONF_TH);
    console.log("After decode: boxes.length = " + boxes.length);
    boxes = lanms(boxes, NMS_TH);
    console.log("After NMS: boxes.length = " + boxes.length);

    let scoreMat = mathjs.zeros(scores.sizes[2], scores.sizes[3]);
    scoreMat.forEach( function(val, index, matrix) {
        matrix.subset(mathjs.index(index[0], index[1]), scores.at([0, 0, index[0], index[1]]));
    });

    let finalRects = [];
    let finalConfs = [];
    if(boxes.length > 0) {
        //const scoreMap = mathjs.squeeze(scores);
        //console.log("scoreMap = " + scoreMap);
        console.log("scores size = " + scores.sizes[2] + ", " + scores.sizes[3]);

        for(let i = 0; i < boxes.length; i++) {

            let mask = new cv.Mat(scores.sizes[2], scores.sizes[3], cv.CV_8UC1, 0);
            //console.log("mask(l,c) = " + mask.rows + ", " + mask.cols);
            boxArr = mathjs.floor(mathjs.divide(boxes[i].slice(0, -1), 4));
            //console.log(boxArr);
            const b = [new cv.Point2(boxArr[0], boxArr[1]), new cv.Point2(boxArr[2], boxArr[3]), 
                       new cv.Point2(boxArr[4], boxArr[5]), new cv.Point2(boxArr[6], boxArr[7])];
            //console.log("b = " + b[0].x + ", " + b[0].y);
            mask.drawFillConvexPoly(b, new cv.Vec(1,1,1));
            let maskArr = mathjs.matrix(mask.getDataAsArray());
            console.log("maskArr.size = " + maskArr.size());
            //let scoreArr = mathjs.matrix(mathjs.reshape(scores.getData(), [scores.sizes[2], scores.sizes[3]]));
            console.log("scoreMat.size = " + scoreMat.size() );
            //console.log("scoreArr[0] = " + scoreArr[0]);
            //console.log("scoreArr[0,0] = " + scoreArr[0, 0] );
            let sum = 0;
            let cnt = 0;
            mathjs.forEach(maskArr, function(val, ind, mtx) {
                //console.log("val = " + val);
                if(val != 0) {
                    //console.log("ind = " + ind[0] + ", " + ind[1] + ", scoreMat = " + scoreMat.subset(mathjs.index(ind[0], ind[1])));
                    sum += scoreMat.subset(mathjs.index(ind[0], ind[1]));
                    cnt++;
                }
            });
            console.log("sum = " + sum + ", cnt = " + cnt);
            let mean = 0;
            if(cnt > 0) {
                mean = sum/cnt;
            }
            if(mean > CONF_TH){
                finalConfs.push(mean);
                let box4 = boxes[i].slice(0, -1).map( function(v, i){ 
                                                    if(i % 2) return v * ratioH;
                                                    else return v * ratioW; 
                                                });
                console.log("box4 = " + box4);
                const startX = Math.min(box4[0], box4[6]);
                const startY = Math.min(box4[1], box4[3]);
                const endX = Math.max(box4[2], box4[4]);
                const endY = Math.max(box4[5], box4[7]);
                
                console.log("startX :" + startX + ". startY :" + startY);
                console.log("width : " + (endX - startX) + ", height : " + (endY - startY));
                finalRects.push(new cv.Rect(startX, startY, endX - startX, endY - startY));
            }            
            delete mask;
        }
    }
    console.log("finalRects = " + finalRects);
    console.log("finalConfs = " + finalConfs);

    let resultList = [];
    await getTextFromImage( imageBytes, finalRects )
        .then(function(results) { 
            console.log("text read success!");
            console.log(results);
            for(let i = 0; i < results.length; i++) {
                let confText = { conf: finalConfs[i], text: results[i].trim() };
                resultList.push(confText);
            }
        })
        .catch(function(e) {
            console.log("Error in text read : " + e.message);
        } );
 
    // Draw rectangle on the image for output
    for(let i = 0; i < finalRects.length; i++) {
        imageMat.drawRectangle(finalRects[i], new cv.Vec(255, 0, 0), 2);
        console.log("Rect = " + finalRects[i].x + ", " + finalRects[i].y);
    }
    cv.imwrite("supercilious.jpg", imageMat);

    resultList.sort( function(a, b) { return b.conf - a.conf; });
    return resultList;
}