var MongoClient = require("mongodb").MongoClient,
    syncIndexes = require("../syncIndexes"),
    assert = require("assert"),
    chai = require("chai"),
    expect = chai.expect,
    _ = require("lodash"),
    async = require("async");

// Connection URL
var url = "mongodb://localhost:27017/test";

before(function() {
    MongoClient.connect(url, function(err, db) {
        assert.equal(err, null);

        db.dropDatabase(function(err) {
            assert.equal(err, null);
        });
    });
});

describe("Sync between array and collection.", function() {

    it("First couple array-collection", function(done) {

        var arrayOfIndexes1 = require("./arrayOfIndexes1.json");

        MongoClient.connect(url, function(err, db) {
            assert.equal(err, null);

            var collectionName = "mongodbSyncIndexesCollection1",
                collection = db.collection(collectionName);

            async.series(
                [
                    // Ensure collection exists
                    function(callback) {
                        db.createCollection(collectionName, function(err) {
                            callback(err);
                        });
                    },
                    // Reset database (important so one test doesn't interfere with another)
                    function(callback) {
                        collection.dropIndexes(function(err) {
                            callback(err);
                        });
                    },
                    // Put some indexes in database to test "drop"
                    function(callback) {
                        collection.createIndex({country_name: 1}, function(err) {
                            callback(err);
                        });
                    },
                    // Execute algorithm
                    function(callback) {
                        syncIndexes(arrayOfIndexes1, collection, {log: true}, callback);
                    }
                ],
                function(err) {
                    db.close();
                    assert.equal(err, null);
                    done();
                }
            );
        });

        //Verification
        //expect(result).to.deep.equal(correctAnswer);

    });
});

describe("Sync between object of arrays and database.", function() {

    it("First couple object-database", function(done) {

        var arrayOfIndexes2 = require("./arrayOfIndexes2.json");

        MongoClient.connect(url, function(err, db) {
            assert.equal(err, null);

            async.series(
                [
                    // Execute algorithm
                    function(callback) {
                        syncIndexes(arrayOfIndexes2, db, {log: true}, callback);
                    }
                ],
                function(err) {
                    db.close();
                    assert.equal(err, null);
                    done();
                }
            );
        });

        //Verification
        //expect(result).to.deep.equal(correctAnswer);

    });
});

after(function() {
    MongoClient.connect(url, function(err, db) {
        assert.equal(err, null);

        db.dropDatabase(function(err) {
            assert.equal(err, null);
        });
    });
});