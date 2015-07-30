'use strict';

var MongoClient = require('mongodb').MongoClient,
    syncIndexes = require('../syncIndexes'),
    assert = require('assert'),
    chai = require('chai'),
    expect = chai.expect,
    _ = require('lodash'),
    async = require('async');

// Connection URL
var url = 'mongodb://localhost:27017/mr_demo';

describe('Check sync between first array and collection.', function() {

    it('Delete from collection indexes absent in array.', function(done) {

        var arrayOfIndexes1 = require('./arrayOfIndexes1.json');

        MongoClient.connect(url, function(err, db) {
            assert.equal(err, null);

            var collection = db.collection('us_economic_assistance');

            collection.dropIndexes(function(err) {
                assert.equal(err, null);

                collection.createIndex({country_name: 1}, function(err, indexName) {
                    assert.equal(err, null);

                    syncIndexes(arrayOfIndexes1, url, 'us_economic_assistance', '', done);
                });
            });
        });

        //Verification
        //expect(result).to.deep.equal(correctAnswer);

    });

    it('Insert in collection indexes present in array but not in collection.', function(done) {

        //Verification
        //expect(result).to.deep.equal(correctAnswer);

        done();
    });
});
