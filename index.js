'use strict';

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

const importReact = {
  type: 'VariableDeclaration',
  kind: 'var',
  declarations: [{
    type: 'VariableDeclarator',
    id: {
      type: 'Identifier',
      name: 'React'
    },
    init: {
      type: 'CallExpression',
      callee: {
        type: 'Identifier',
        name: 'require'
      },
      arguments: [{
        type: 'Literal',
        value: 'react'
      }]
    }
  }]
};

const importAssign = {
  type: 'VariableDeclaration',
  kind: 'var',
  declarations: [{
    type: 'VariableDeclarator',
    id: {
      type: 'Identifier',
      name: 'objectAssign'
    },
    init: {
      type: 'CallExpression',
      callee: {
        type: 'Identifier',
        name: 'require'
      },
      arguments: [{
        type: 'Literal',
        value: 'object-assign'
      }]
    }
  }]
};

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
      value: {
        type: 'Literal',
        value: attrs[name]
      },
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
    arguments: [{
      type: 'Literal',
      value: node.name
    }, props].concat(children)
  };
}

function assignPropsWrapper(props) {
  return {
    type: 'CallExpression',
    callee: {
      type: 'Identifier',
      name: 'objectAssign'
    },
    arguments: [{
      type: 'ObjectExpression',
      properties: []
    }, props, {
      type: 'Identifier',
      name: 'props'
    }]
  };
}

function component(node) {
  return {
    type: 'FunctionExpression',
    id: null,
    params: [{
      type: 'Identifier',
      name: 'props'
    }],
    defaults: [],
    body: {
      type: 'BlockStatement',
      body: [{
        type: 'ReturnStatement',
        argument: element(node, assignPropsWrapper)
      }]
    },
    generator: false,
    expression: false
  };
}

function componentExport(source) {
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
      right: component(root)
    }
  };
}

function esTree(source) {
  return {
    type: 'Program',
    body: [importReact, importAssign, componentExport(source)]
  };
}

function iconLoader(source) {
  if (this.cacheable) {
    this.cacheable();
  }
  return escodegen.generate(esTree(source));
}

module.exports = iconLoader;
