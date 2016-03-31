'use strict';

const path = require('path');
const css = require('css');
const escodegen = require('escodegen');
const xmlParser = require('xml-parser');
const svgPropertyConfig = require('react/lib/SVGDOMPropertyConfig');
const htmlPropertyConfig = require('react/lib/HTMLDOMPropertyConfig');
const domFactories = require('react/lib/ReactDOMFactories');

const allowedTags = Object.keys(domFactories);
const allowedAttrs = {};

Object.keys(htmlPropertyConfig.DOMAttributeNames).forEach(reactName => {
  allowedAttrs[svgPropertyConfig.DOMAttributeNames[reactName]] = reactName;
});

Object.keys(svgPropertyConfig.DOMAttributeNames).forEach(reactName => {
  allowedAttrs[svgPropertyConfig.DOMAttributeNames[reactName]] = reactName;
});

Object.keys(htmlPropertyConfig.Properties).forEach(name => {
  allowedAttrs[name] = name;
});

Object.keys(svgPropertyConfig.Properties).forEach(name => {
  allowedAttrs[name] = name;
});

const restrictedAttrs = {
  svg: ['width', 'height', 'id']
};

function importExpr(id, path, es6) {
  const requireExpr = {
    type: 'CallExpression',
    callee: {
      type: 'Identifier',
      name: 'require'
    },
    arguments: [
      {
        type: 'Literal',
        value: path
      }
    ]
  };
  return {
    type: 'VariableDeclaration',
    kind: 'var',
    declarations: [
      {
        type: 'VariableDeclarator',
        id: {
          type: 'Identifier',
          name: id
        },
        init: es6 ? {
          type: 'MemberExpression',
          computed: false,
          object: requireExpr,
          property: {
            type: 'Identifier',
            name: 'default'
          }
        } : requireExpr
      }
    ]
  };
}

function literalValue(value) {
  return {
    type: 'Literal',
    value: value
  };
}

function styleValue(value) {
  const declarations = css.parse('*{' + value + '}').stylesheet.rules[0].declarations;
  return {
    type: 'ObjectExpression',
    properties: declarations.map(declaration => ({
      type: 'Property',
      key: {
        type: 'Literal',
        value: declaration.property
      },
      value: {
        type: 'Literal',
        value: declaration.value
      },
      computed: false,
      kind: 'init',
      method: false,
      shorthand: false
    }))
  };
}

function attrsDeclaration(attrs) {
  if (!Object.keys(attrs).length) {
    return {
      type: 'Literal',
      value: null
    };
  }
  const declaration = {
    type: 'ObjectExpression',
    properties: []
  };
  Object.keys(attrs).forEach(name => {
    declaration.properties.push({
      type: 'Property',
      key: {
        type: 'Identifier',
        name: name
      },
      value: name === 'style' ? styleValue(attrs[name]) : literalValue(attrs[name]),
      computed: false,
      kind: 'init',
      method: false,
      shorthand: false
    });
  });
  return declaration;
}

function element(node, propsWrapper) {
  const attrs = {};
  Object.keys(node.attributes).forEach(name => {
    if (allowedAttrs[name] && (!restrictedAttrs[node.name] || restrictedAttrs[node.name].indexOf(name) === -1)) {
      attrs[allowedAttrs[name]] = node.attributes[name];
    }
  });
  let props = attrsDeclaration(attrs);
  if (propsWrapper) {
    props = propsWrapper(props);
  }
  const children = node.children
    .filter(child => allowedTags.indexOf(child.name) !== -1)
    .map(child => element(child));
  return {
    type: 'CallExpression',
    callee: {
      type: 'MemberExpression',
      computed: false,
      object: {
        type: 'Identifier',
        name: 'React'
      },
      property: {
        type: 'Identifier',
        name: 'createElement'
      }
    },
    arguments: [
      {
        type: 'Literal',
        value: node.name
      }, props
    ].concat(children)
  };
}

function assignPropsWrapper(props) {
  return {
    type: 'CallExpression',
    callee: {
      type: 'Identifier',
      name: 'objectAssign'
    },
    arguments: [
      props, {
        type: 'Identifier',
        name: 'props'
      }
    ]
  };
}

function component(node) {
  return {
    type: 'FunctionExpression',
    id: null,
    params: [
      {
        type: 'Identifier',
        name: 'props'
      }
    ],
    defaults: [],
    body: {
      type: 'BlockStatement',
      body: [
        {
          type: 'ReturnStatement',
          argument: element(node, assignPropsWrapper)
        }
      ]
    },
    generator: false,
    expression: false
  };
}

function componentExport(source, filename) {
  const doc = xmlParser(source);
  const root = doc.root;
  return {
    type: 'ExpressionStatement',
    expression: {
      type: 'AssignmentExpression',
      operator: '=',
      left: {
        type: 'MemberExpression',
        computed: false,
        object: {
          type: 'Identifier',
          name: 'module'
        },
        property: {
          type: 'Identifier',
          name: 'exports'
        }
      },

      right: {
        type: 'CallExpression',
        callee: {
          type: 'CallExpression',
          callee: {
            type: 'Identifier',
            name: 'compose'
          },
          arguments: [
            {
              type: 'CallExpression',
              callee: {
                type: 'Identifier',
                name: 'setDisplayName'
              },
              arguments: [
                {
                  type: 'Literal',
                  value: 'react-icon(' + filename + ')'
                }
              ]
            },
            {
              type: 'Identifier',
              name: 'pure'
            }
          ]
        },
        arguments: [component(root)]
      }
    }
  };
}

function esTree(source, filename) {
  return {
    type: 'Program',
    body: [
      importExpr('React', 'react'),
      importExpr('objectAssign', 'object-assign'),
      importExpr('compose', 'recompose/compose', true),
      importExpr('pure', 'recompose/pure', true),
      importExpr('setDisplayName', 'recompose/setDisplayName', true),
      componentExport(source, filename)
    ]
  };
}

function iconLoader(source) {
  if (this.cacheable) {
    this.cacheable();
  }
  return escodegen.generate(esTree(source, path.basename(this.resourcePath)));
}

module.exports = iconLoader;
