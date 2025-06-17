const path = require('path');
const decrypt = require('./decrypt');
const log = require("./GrayLog");

const getCloudDinaryOtions = (urlPath) => {

    var processUrl = convertNewLayerFormat(urlPath);

    console.log("process url: ", processUrl);

    if (processUrl.indexOf("/rx") == 0) {
        // Amazon resize: example uri: /rx/1500,q_90,ofmt_webp/s2/p/12130/17a2421cd0c5891b867c2d65cde7c60d.png
        return getAmazonOptions(processUrl);
    }

    var checkOptions = {};

    var variables = processUrl.split("/");

    var currentAction = {};
    var actionList = [];
    var endAcion = false;
    var sourceOptions = {
        width: 1280,
        height: 1600,
        format: "png",
        input: ""
    };

    var cloudinaryFormat;
    var lastFormat;
    variables.forEach((item) => {
        if ((item.indexOf("l_") != -1 && item.indexOf("layer") == -1) || item.indexOf("l_d") != -1) {
            currentAction.input = getInput(item);
            currentAction.blend = "over";
        }

        if (item.indexOf("s_1") != -1) {
            checkOptions.disable = true;
        }

        if (item.indexOf("u_") != -1 || item.indexOf("u_d") != -1) {
            currentAction.input = getInput(item);
            currentAction.blend = "dest-over";
        }

        if (item.indexOf("fl_cutter") != -1) {
            currentAction.blend = "dest-in";
        }

        if (item.indexOf("co_rgb") != -1) {
            let color = getColor(item);
            checkOptions.color = color;
            currentAction.fillColor = "#" + color;
        }

        if (item.indexOf("c_thum") != -1) {
            let width = parseInt(getWidth(item));
            sourceOptions.width = width;
            checkOptions.width = width;
        }

        if (item.indexOf("f_") != -1) {
            cloudinaryFormat = getFormat(item);
        }

        if (item.indexOf("ofmt") != -1) {
            lastFormat = getLastFormat(item);
        }


        if (item == "v1" || item == "s2") {
            endAcion = true;
            return;
        }

        if (endAcion) {
            sourceOptions.input += "/" + item;
        }

        if (item.indexOf("fl_layer_apply") != -1) {
            if (Object.keys(currentAction).length != 0) {
                actionList.push(currentAction);
                currentAction = {};
            }
        }

    })
    sourceOptions.format = lastFormat || cloudinaryFormat || "png";
    if (sourceOptions.format.toLowerCase() == "jpg") {
        sourceOptions.format = "jpeg";
    }
    sourceOptions.input = getSourceInput(sourceOptions.input)

    var config = convertToRenderOptions(actionList, sourceOptions);
    if (config.resize) {
        checkOptions.width = config.resize.width;
        checkOptions.height = config.resize.height;
    }
    return { config, format: sourceOptions.format, checkOptions };

    /*************************************** Functions ************************************************/
    function getCompsiteAction(actionList, input) {
        var composites = [];
        composites.push(input);

        actionList.forEach((action) => {
            var input = action.input;
            if (action.fillColor) {
                input = {
                    fillColor: [
                        action.input,
                        action.fillColor
                    ]

                }
            }

            composites.push({
                input: input,
                blend: action.blend
            })

        })

        return composites;
    }

    function convertToRenderOptions(actionList, sourceOptions) {
        var renderOptions = {};
        var input;
        if (actionList.length == 0) {
            //Only background
            input = sourceOptions.input;
        } else {
            var compositeAction = getCompsiteAction(actionList, sourceOptions.input);
            input = {
                composite: compositeAction
            };
        }
        if (sourceOptions.width) {
            renderOptions.resize = {
                width: sourceOptions.width,
                height: parseInt(1600 * sourceOptions.width / 1280),
                format: sourceOptions.format,
                input: input
            }
        } else {
            renderOptions = input;
        }
        return renderOptions;
    }

    function getColor(str) {
        const regex = /rgb:(.*),/gm;
        var result = regex.exec(str)[1];
        return result;
    }
    ;

    function getInput(str) {
        const regex = /_(.*)/gm;
        var path = regex.exec(str)[1];
        path = path.replaceAll(":", "/");
        path = decryptPathIfNeed(path);
        return path;
    }
    ;

    function getWidth(str) {
        const regex = /w_(.*)/gm;
        var result = regex.exec(str)[1];
        return result;
    }
    ;

    function getFormat(str) {
        const regex = /f_(.*)/gm;
        var result = regex.exec(str)[1];
        return result;
    }

    function getLastFormat(str) {
        const regex = /ofmt_(.*)/gm;
        var result = regex.exec(str)[1];
        return result;
    }

    function getPosition(str) {
        try {
            const regex = /po:(\d*):(\d*):(\d*):(\d*)\/([^\?]*)/gm;
            var result = regex.exec(str);
            // console.log(result);
            if (result) {
                var position = {
                    position: {
                        input: result[5],
                        position: {
                            top: parseInt(result[1]),
                            left: parseInt(result[2]),
                            width: parseInt(result[3]),
                            height: parseInt(result[4]),
                        }
                    }
                }
                return position;
            }
            return false;

        }
        catch (e) {
            return false;
        }
    }

    function getSourceInput(str) {
        const regex = /\/([^\?]*)/gm;
        try {
            var result = regex.exec(str)[1];
            result = decryptPathIfNeed(result);
            var positionInput = getPosition(str);
            if (positionInput) {
                result = positionInput;
            }
        } catch (e) {
            const message = `Get source error: ${urlPath}. Error message: ${e.message}`
            var error = new Error(message);
            throw error;
        }
        return result;
    }

}

function getDpi(str) {
    console.log("get dpi", str);
    const regex = /dp_(\d*)/gm;
    var result = regex.exec(str)[1];
    console.log(result);

    return parseInt(result);
}

function getImageFormatByExt(ext) {
    var list = {
        jpg: "jpeg",
        jpeg: "jpeg",
        jpe: "jpeg",
        png: "png",
        webp: "webp",
        gif: "gif",
    }

    return list[ext];
}

function decryptPathIfNeed(path) {
    if (path.indexOf("e/") == 0) {
        path = decodeURIComponent(path.substring(2));
        return decrypt(path);
    } else {
        return path;
    }
}

function getAmazonOptions(urlPath) {
    var checkOptions = {};
    var type = "download", width, height, format, imagePath, fit, backgroundColor;
    var match;
    var options;
    var config = {};
    var timeout = 100000; // 100 seconds
    var density;
    var maxOldSize = false;
    var colorSpace = "";
    var renderOptions = {};
    var embroideryType;
    var dpi;
    var noxmp = false;

    if ((match = /rx\/(.*)\/s[\d]\/([^\?](?:(?!\/t\/).)*)/gm.exec(urlPath)) != null) {
        imagePath = match[2];
        options = match[1];

        if (imagePath) {
            imagePath = imagePath.split('?')[0]
        }
    }


    if ((match = /ofmt_([a-z]*)/gm.exec(options)) != null) {
        format = match[1];
    }

    if ((match = /co_([a-zA-z\d]*)/gm.exec(options)) != null) {
        backgroundColor = "#" + match[1];
    }

    if ((match = /^(\d+)x*(\d*)/.exec(options)) != null) {
        type = "resize";
        width = match[1];
        if (match[2]) {
            height = match[2];
            fit = "inside";
        }
    }

    if (options.indexOf("c_1") != -1) {
        fit = "cover";
        type = "resize";
    }

    if (options.indexOf("dp_") != -1) {
        density = getDpi(options);
    }

    if (options.indexOf("noxmp") != -1) {
        noxmp = true;
        renderOptions.noxmp = noxmp;
    }

    if (options.indexOf("c_2") != -1) {
        fit = "contain";
        type = "resize";
        if (!density) {
            density = 300;
        }
        // backgroundColor = "#00FFFFFF";
    }

    if ((colorSpaceMatch = /cs_([a-z1-9]*)/.exec(options)) != null) {
        colorSpace = colorSpaceMatch[1];
        renderOptions.colorSpace = colorSpace;
    }

    if (options.indexOf("r_1") != -1) {
        maxOldSize = true;
    }

    if (options.indexOf("c_3") != -1) {
        type = "trim";
        if (!density) {
            density = 300
        }

    }

    if (options.indexOf("s_1") != -1) {
        checkOptions.disable = true;
    }

    if (options.indexOf("fe_1") != -1) {
        embroideryType = 1;
        type = "embroidery";
    }


    if (width) {
        renderOptions.width = parseInt(width);
        checkOptions.width = width;
    }
    if (height) {
        renderOptions.height = parseInt(height);
        checkOptions.height = height;
    }

    if (fit) {
        renderOptions.fit = fit;
    }

    if (format) {
        renderOptions.format = format;
    }

    // if(embroideryType) {
    //     renderOptions.type = embroideryType;
    // }

    renderOptions.density = density;

    if (!format) {
        const ext = path.extname(imagePath).substr(1);
        format = getImageFormatByExt(ext);
        // console.log("kien test", format, path.extname, ext);
        if (format == "gif") {
            // Set default format for gif is web
            format = "webp";
            if (type == "download") {
                renderOptions.format = format
            }
        }
        if (type == "resize") {
            renderOptions.format = format;
        }

    }

    /**
     * Fix path mistake likes: http://senasia.s3-ap-southeast-1.amazonaws.com/email//social-facebook.png
     */
    imagePath = imagePath.replaceAll("//", "/");

    if (imagePath) {
        imagePath = decryptPathIfNeed(imagePath);
    }
    renderOptions.input = imagePath;
    if (backgroundColor) {
        renderOptions.backgroundColor = backgroundColor;
    }
    renderOptions.maxOldSize = maxOldSize;
    if (type == "embroidery") {
        // renderOptions = { input: { resize: renderOptions }, type: embroideryType };
        renderOptions.format = "png";
        config = {
            format: {
                format: format,
                input: {
                    embroidery: {
                        input: { resize: renderOptions },
                        type: embroideryType
                    }
                }
            },
            workerHigh: true
        }
    }
    else {
        config[type] = renderOptions;
        if (!format) {
            format = "png";
        }
        if (!config.format) {
            config.format = format;
        }
    }
    return { config, format, timeout, checkOptions };
}

function convertNewLayerFormat(processUrl) {
    var acceptedColors =
        ["d3d3d3", "dedede", "363636",
            "5B5B5D", "2D372E", "D5D6DB", "E07655",
            "6D5173", "00966C", "B83A4B", "595478",
            "1D4F91", "651D32", "43695B", "707372",
            "363636", "3A3C43", "7F64AE", "5ACB94",
            "131313", "43E1FF", "3279FF", "8F8F8F",
            "8A51B2", "97999B", "43E1FF", "3F3E3D",
            "EEEEEE", 'C5C5CF', 'E2DFD6', '939393'];


    if (processUrl.indexOf("_sh") == -1) {
        return processUrl;
    }

    var enable = false;
    for (var color of acceptedColors) {
        var stringToCheck = "co_rgb:" + color.toLowerCase();
        if (processUrl.toLowerCase().indexOf(stringToCheck) != -1) {
            enable = true;
            // console.log("Convert layer with color", color);
            break;
        }
    }

    if (!enable) {
        return processUrl;
    }

    processUrl = processUrl.replace("_sh", "_sdh");

    const regex = /(.*)\/fl_cutter,fl_layer_apply\/(.*)\/fl_layer_apply\/l_p(.*)_sdh\/fl_layer_apply\/(.*)\/fl_layer_apply\/(.*)/gm;

    let m;

    if ((m = regex.exec(processUrl)) !== null) {
        var newUrl = `${m[1]}/fl_cutter,fl_layer_apply/u_p${m[3]}_sdh/fl_layer_apply/${m[2]}/fl_layer_apply/${m[4]}/fl_layer_apply/${m[5]}`;
        return newUrl;
    } else {
        console.error("Can not find regex, path:", processUrl)
        return processUrl;
    }

}

module.exports = getCloudDinaryOtions;