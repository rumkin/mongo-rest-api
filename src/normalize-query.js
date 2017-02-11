'use strict';

const keyget = require('keyget');

function normalizeQuery(query) {
    let result = {};
    
    Object.getOwnPropertyNames(query || {})
    .forEach((prop) => {
        keyget.set(result, prop, JSON.parse(query[prop]));
    });
    
    return result;
}

module.exports = normalizeQuery;