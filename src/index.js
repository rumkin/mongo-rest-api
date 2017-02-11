'use strict';

const hall = require('hall');
const normalizeQuery = require('./normalize-query.js');
const _ = require('lodash');
const camelcase = require('camelcase');
const uuid = require('uuid');

function mongoRestFactory(mongo, options = {}) {
    const router =  hall();
    _.defaults(options, {
       prefix: '', 
    });
    
    const prefix = options.prefix;
    
    function getColName(name) {
        return prefix + camelcase(name);
    }
    
    router.get('/:collection', (req, res, next) => {
        let colName = req.params.collection;
        let params = normalizeQuery(req.query);

        let cursor = mongo.collection(getColName(colName)).find(params.q || {});
        
        if (params.project) {
            cursor.project(params.project)
        }
        
        if (params.skip) {
            cursor.skip(params.skip);
        }
        
        if (params.limit) {
            cursor.limit(params.limit);
        }
        
        cursor.toArray()
        .then((documents) => {
            sendJson(res, documents);
        })
        .catch(next);
    });
    
    router.post('/:collection', (req, res, next) => {
        let colName = req.params.collection;
        let body = req.body;
        
        if (Array.isArray(body)) {
            let items = body.map((item) => {
                if (! item._id) {
                    item._id = uuid();
                }
                return item;
            })
            mongo.collection(getColName(colName))
            .insertMany(body)
            .then((r) => {
                sendJson(res, _.pick(r, [
                    'insertedCount',
                    'insertedIds',
                    'result',
                ]));
            })
            .catch(next);
        }
        else {
            if (! body._id) {
                body._id = uuid();
            }
            mongo.collection(getColName(colName))
            .insertOne(body)
            .then((r) => {
                sendJson(res, _.omit(r, ['connection']));
            })
            .catch(next);
        }
    });
    
    router.put('/:collection', (req, res, next) => {
        let colName = req.params.collection;
        let params = normalizeQuery(req.query);
        let body = req.body;
        
        mongo.collection(getColName(colName))
        .updateMany(params.q || {}, body)
        .then((r) => {
            sendJson(res, _.pick(r, [
                'matchedCount',
                'modifiedCount',
                'upsertedCount',
                'upsertedId',
                'result',
            ]));
        })
        .catch(next);
    });
    
    router.delete('/:collection', (req, res, next) => {
        let colName = req.params.collection;
        let params = normalizeQuery(req.query);
        
        mongo.collection(getColName(colName))
        .deleteMany(params.q)
        .then((r) => {
            sendJson(res, _.pick(r, [
                'result',
                'deletedCount',
            ]));
        })
        .catch(next);
    });
    
    router.get('/:collection/:id', (req, res, next) => {
        let colName = req.params.collection;
        let id = req.params.id;
        
        mongo.collection(getColName(colName))
        .findOne({
            _id: id,
        })
        .then((doc) => {
            if (! doc) {
                next();
                return;
            }
            
            sendJson(res, doc);
        })
        .catch(next);
    });
    
    router.put('/:collection/:id', (req, res, next) => {
        let colName = req.params.collection;
        let id = req.params.id;
        let col = mongo.collection(getColName(colName));
        
        col.findOne({
            _id: id,
        }, {_id: 1})
        .then((doc) => {
            if (! doc) {
                next();
                return;
            }
            
            return col.updateOne({_id: id}, req.body)
            .then((r) => {
                sendJson(res, _.pick(r, [
                    'matchedCount',
                    'modifiedCount',
                    'upsertedCount',
                    'upsertedId',
                    'result',
                ]));
            });
        })
        .catch(next);
    });
    
    router.delete('/:collection/:id', (req, res, next) => {
        let colName = req.params.collection;
        let id = req.params.id;
        let col = mongo.collection(getColName(colName));
        
        col.findOne({
            _id: id,
        }, {_id: 1})
        .then((doc) => {
            if (! doc) {
                next();
                return;
            }
            
            return col.deleteOne({_id: id})
            .then((r) => {
                sendJson(res, _.pick(r, [
                    'result',
                    'deletedCount',
                ]));
            });
        })
        .catch(next);
    });
    
    return router;
}

function sendJson(res, data) {
    res.setHeader('content-type', 'application/json');
    res.write(JSON.stringify(data, null));
    res.end();
}

module.exports = mongoRestFactory;