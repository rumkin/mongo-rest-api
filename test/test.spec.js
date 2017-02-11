'use strict';

const should = require('should');
const mongodb = require('mongodb');
const fetch = require('node-fetch');
const connect = require('connect');
const bodyParser = require('body-parser');
const mongoRest = require('..');
const url = require('url');
const {URL} = url;

describe('Mongodb REST driver:', () => {
    let mongo, request;
    before(() => {
        return mongodb.connect('mongodb://localhost/rest-db')
        .then((db) => mongo = db);
    });
    
    before(() => {
        let router = mongoRest(mongo);
        
        let http = connect()
        .use(bodyParser.json())
        .use((req, res, next) => {
            let parsed = url.parse(req.url, true);
            
            req.url = parsed.pathname;
            req.query = parsed.query;
            
            next();
        })
        .use(mongoRest(mongo))
        .use((err, req, res, next) => {
            console.error(err);
            res.statusCode = 500;
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({
                error: err.toString(),
            }, null));
        })
        .listen();
        
        let address = http.address();
        
        request = function(url, method, data) {
            let options = {
                method,
            };
            
            if (method.toLowerCase() !== 'get') {
                options.headers = {
                    'content-type': 'application/json'
                };
                options.body = JSON.stringify(data, null);
            }

            let uri = new URL(`http://localhost:${address.port}/${url}`);
            
            return fetch(uri.toString(), options)
            .then((res) => {
                if (! res.headers.get('content-type').includes('application/json')) {
                    return res;
                }
                
                return res.json().then((data) => {
                    res.data = data;
                    return res;
                })
            });
        };
        
        request.get = function(url) {
            return this(url, 'get');
        };
        
        request.post = function(url, data) {
            return this(url, 'post', data);
        };
        
        request.delete = function(url, data) {
            return this(url, 'delete', data);
        };
        
        request.put = function(url, data) {
            return this(url, 'put', data);
        };
        
        request.patch = function(url, data) {
            return this(url, 'patch', data);
        };
    });
    
    after(() => process.env.DROP === '0' || mongo.dropDatabase());
    
    describe('POST /:collection.', () => {
        it('Should insert single document', () => {
            return request.post('users', {
                user: 'a',
                age: 20,
            })
            .then(({status, data}) => {
                should(status).be.equal(200);
                should(data).be.instanceOf(Object);
                should(data).has.ownProperty('ok', 1);
            });
        });
        
        it('Should insert many documents', () => {
            return request.post('users', [
                {
                    user: 'b',
                    age: 30,
                },
                {
                    user: 'c',
                    age: 40,
                },
            ])
            .then(({status, data}) => {
                should(status).be.equal(200);
                
                should(data.insertedCount).be.equal(2);
                should(data.insertedIds).be.instanceOf(Array);
                should(data.insertedIds).has.length(2);
            });
        });
    });
    
    describe('PUT /:collection.', () => {
        it('Should update single document', () => {
            return request.put('users', {
                $set: {
                    version: 1,
                },
            })
            .then(({status, data}) => {
                should(status).be.equal(200);
                
                should(data).be.instanceOf(Object);
                should(data).has.ownProperty('matchedCount', 3);
                should(data).has.ownProperty('modifiedCount', 3);
                should(data).has.ownProperty('upsertedCount', 0);
                should(data).has.ownProperty('upsertedId', null);
            });
        });
        
        it('Should update documents with query', () => {
            return request.put('users?q.age.$gte=30', {
                $set: {
                    version: 2,
                },
            })
            .then(({status, data}) => {
                should(status).be.equal(200);
                
                should(data).be.instanceOf(Object);
                should(data).has.ownProperty('matchedCount', 2);
                should(data).has.ownProperty('modifiedCount', 2);
                
                return request.get('users?q.version=2')
                .then(({status, data}) => {
                    should(status).be.equal(200);
                
                    should(data).be.instanceOf(Array);
                    should(data).has.length(2);
                });
            });
        });
    });
    
    describe('GET /:collection.', () => {
        it('Should retrieve documents', () => {
            return request.get('users')
            .then(({status, data}) => {
                should(status).be.equal(200);
                should(data).be.instanceOf(Array);
                should(data).has.length(3);
            });
        });
        
        it('Should retrieve with params', () => {
            return request.get('users?q.age.$gte=30&project.name=1')
            .then(({status, data}) => {
                should(status).be.equal(200);
                should(data).be.instanceOf(Array);
                should(data).has.length(2);
            });
        });
    });
    
    describe('DELETE /:collection.', () => {
        it('Should retrieve with params', () => {
            return request.delete('users?q.age.$gte=40')
            .then(({status, data}) => {
                should(status).be.equal(200);
                should(data).be.instanceOf(Object);
                should(data).has.ownProperty('deletedCount', 1);
            });
        });
        
        it('Should retrieve with params', () => {
            return request.delete('users')
            .then(({status, data}) => {
                should(status).be.equal(200);
                should(data).be.instanceOf(Object);
                should(data).has.ownProperty('deletedCount', 2);
            });
        });
    });
    
    describe('GET /:collection/:id', () => {
        let doc;
        
        before(() => {
            return request.post('users', {
                user: 'a',
                age: 20,
            })
            .then(() => request.get('users'))
            .then(({status, data}) => {
                should(status).be.equal(200);
                
                should(data).be.instanceOf(Array);
                should(data).has.length(1);
                
                doc = data[0];
            })
            ;
        });
        
        it('Should retrive document by id', () => {
            return request.get('users/' + doc._id)
            .then(({status, data}) => {
                should(status).be.equal(200);
                
                should(data).be.instanceOf(Object);
                should(data).be.deepEqual(doc);
            });
        });
    });
    
    describe('PUT /:collection/:id', () => {
        let doc;
        
        before(() => {
            return request.post('users', {
                user: 'b',
                age: 27,
            })
            .then(() => request.get('users?q.user="b"'))
            .then(({status, data}) => {
                should(status).be.equal(200);
                
                should(data).be.instanceOf(Array);
                should(data).has.length(1);
                
                doc = data[0];
            })
            ;
        });
        
        it('Should update document by id', () => {
            return request.put('users/' + doc._id, {
                $set: {age: 30},
            })
            .then(() => 
                request.get('users/' + doc._id)
                .then(({status, data}) => {
                    should(status).be.equal(200);
                    
                    should(data).be.instanceOf(Object);
                    should(data.age).be.equal(30);
                })
            );
        });
    });
    
    describe('DELETE /:collection/:id', () => {
        let doc;
        
        before(() => {
            return request.post('users', {
                user: 'c',
                age: 40,
            })
            .then(() => request.get('users?q.user="b"'))
            .then(({status, data}) => {
                should(status).be.equal(200);
                
                should(data).be.instanceOf(Array);
                should(data).has.length(1);
                
                doc = data[0];
            })
            ;
        });
        
        it('Should delete document by id', () => {
            return request.delete('users/' + doc._id)
            .then(() => 
                request.get('users/' + doc._id)
                .then(({status}) => {
                    should(status).be.equal(404);
                })
            );
        });
    });
});
