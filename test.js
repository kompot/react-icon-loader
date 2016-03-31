const fs = require('fs');
const React = require('react');
const ReactDOM = require('react-dom/server');

const loader = require('./index');

const context = {
  resourcePath: '/foo/bar/foobar.svg'
};

const src = '<svg version="1.2"><line style="stroke-width:2;"></line><rect width="100" style="fill:red;"></rect></svg>';

const js = loader.call(context, src);

fs.writeFileSync('result.js', js, 'utf-8');

const component = require('./result');

console.log(src);
const result = ReactDOM.renderToStaticMarkup(React.createElement(component));
console.log(result);

if (src !== result) {
  process.exit(1);
} else {
  console.log('\nok');
}
