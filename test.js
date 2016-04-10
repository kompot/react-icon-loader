const fs = require('fs');

const React = require('react');
const ReactDOM = require('react-dom/server');
const SVGO = require('svgo');
const glob = require('glob');

function optimize(source, options) {
  const svgo = new SVGO(options || {});
  return new Promise(resolve => {
    svgo.optimize(source, result => {
      resolve(result.data);
    });
  });
}

function readSvg(path) {
  return new Promise((resolve, reject) => {
    fs.readFile(path, 'utf-8', (err, svgSource) => {
      if (err) {
        reject(err);
      } else {
        resolve(svgSource);
      }
    });
  });
}

const loader = require('./index');

const context = {
  resourcePath: '/foo/bar/foobar.svg'
};


function transform(svgSource) {
  const js = loader.call(context, svgSource);
  const module = {};
  eval(js);
  const markup = ReactDOM.renderToStaticMarkup(React.createElement(module.exports));
  return markup;
}

const cleanupOpts = {
  plugins: [{
    removeAttrs: {
      attrs: [
        'svg:width',
        'svg:height',
        'svg:xmlns'
      ]
    }
  }]
};

function transformAndCompare(path, svgSource) {
  return Promise.all([optimize(svgSource, cleanupOpts), optimize(transform(svgSource))]).then(result => {
    const source = result[0];
    const markup = result[1];
    if (source === markup) {
      return path;
    }
    return Promise.reject({
      path,
      source,
      markup
    });
  });
}

function testSvg(path) {
  return readSvg(path).then(svgSource => transformAndCompare(path, svgSource));
}

glob('node_modules/material-design-icons/**/svg/production/*.svg', null, (err, files) => {
  files.forEach(file => {
    testSvg(file).then(res => {
      console.log(res, 'OK');
    }).catch(err => {
      console.error(err);
      process.exit(1);
    });
  });
});
