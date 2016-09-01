var React = require('react');
var ReactNative = require('react-native');
var htmlparser = require('./vendor/htmlparser2');
var entities = require('./vendor/entities');

var {
    Text,
    Dimensions,
} = ReactNative;

var Image = require('./helper/Image');

var LINE_BREAK = '\n';
var PARAGRAPH_BREAK = '\n\n';
var BULLET = '\u2022 ';

function htmlToElement(rawHtml, opts, done) {
    function domToElement(dom, parent, level) {
        if (!dom) return null

        return dom.map((node, index, list) => {
            if (opts.customRenderer) {
                var rendered = opts.customRenderer(node, index, list)
                    if (rendered || rendered === null) return rendered
            }

            if (node.type == 'text') {
                //replace multi-whitespace with single space, just like html
                var text = (node.prependText||'') + node.data.replace(/\s+/g,' ');
                if (!parent || (parent && parent.isBlock && (index == 0 || index == dom.length -1))) {
                    //text nodes within block elements are trimmed if they aren't the middle siblings
                    text = text.trim();
                }
                if (!text) {
                    return null;
                }
                return (
                    <Text key={index} style={parent ? nonViewStyles(opts.styles[parent.name]) : null}>
                      {entities.decodeHTML(text)}
                    </Text>
                )
            }

            if (node.type == 'tag') {
                if (node.name == 'img') {
                    var img_w = +node.attribs['width'] || +node.attribs['data-width'] || 0
                    var img_h = +node.attribs['height'] || +node.attribs['data-height'] || 0

                    var img_style = {
                        width: img_w,
                        height: img_h,
                    }
                    var source = {
                        uri: node.attribs.src,
                        width: img_w,
                        height: img_h,
                    }
                    return (
                        <Image key={index} source={source} style={img_style} maxWidth={opts.maxWidth} />
                    )
                }

                var linkPressHandler = null
                if (node.name == 'a' && node.attribs && node.attribs.href) {
                    linkPressHandler = () => opts.linkHandler(entities.decodeHTML(node.attribs.href))
                }
                
                //https://developer.mozilla.org/en-US/docs/Web/HTML/Block-level_elements
                var isBlock = [
                    'address','article','aside','blockquote','canvas','dd','div','dl','fieldset',
                    'figcaption','figure','footer','form',
                    'h1','h2','h3','h4','h5','h6',
                    'header','hgroup','hr','li','main','nav','noscript','ol','output',
                    'p','pre','section','table','tfoot','ul','video',
                ].indexOf(node.name) != -1;
                node.isBlock = isBlock;

                //If it's an LI, look for the first Text node descendant and prepend with a bullet.
                if (node.name == 'li') {
                    var setPre = false;
                    var currentNode = node;
                    while(currentNode.children && currentNode.children.length > 0 && !setPre) {
                        currentNode = currentNode.children[0];
                        if (currentNode.type == 'text') {
                            currentNode.prependText = BULLET + ' ';
                            setPre = true;
                        }
                    }
                }
                
                if (isBlock) {
                    return (
                        <View key={index} style={{...viewStyles(opts.styles[node.name]),width:opts.maxWidth}}>
                          {domToElement(node.children, node, level+1)}
                        </View>
                    )
                }
                
                return (
                    <Text key={index} onPress={linkPressHandler}>
                    {domToElement(node.children, node,level+1)}
                    </Text>
                )
            }
        })
    }

    var handler = new htmlparser.DomHandler(function(err, dom) {
        if (err) done(err)
            done(null, domToElement(dom,null,0))
    })
        var parser = new htmlparser.Parser(handler)
        parser.write(rawHtml)
        parser.done()
}

//Block elements can have vertical whitespace, but inline cannot.
var viewStyleList = [
    'marginTop','marginBottom','marginVertical',
    'paddingTop','paddingBottom','paddingVertical',
]

function viewStyles (allStyles) {
    var viewStyles = {};
    if (allStyles) {
        for (styleName in allStyles) {
            if (viewStyleList.indexOf(styleName) != -1) {
                viewStyles[styleName] = allStyles[styleName];
            }
        }
    }
    return viewStyles;
}

function nonViewStyles (allStyles) {
    var viewStyles = {};
    if (allStyles) {
        for (styleName in allStyles) {
            if (viewStyleList.indexOf(styleName) == -1) {
                viewStyles[styleName] = allStyles[styleName];
            }
        }
    }
    return viewStyles;
}


module.exports = htmlToElement
