var MongoClient = require("mongodb").MongoClient,
    syncIndexes = require("../syncIndexes"),
    assert = require("assert"),
    chai = require("chai"),
    expect = chai.expect,
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
        var correctAnswer1 = require("./answer1.json");

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
                        syncIndexes(arrayOfIndexes1, collection, {log: false}, callback);
                    }
                ],
                function(err) {
                    assert.equal(err, null);
                    collection.indexes(function(err, indexes) {
                        assert.equal(err, null);

                        //Verification
                        expect(indexes).to.deep.equal(correctAnswer1);

                        //Close database and finish test
                        db.close();
                        done();
                    });
                }
            );
        });
    });

    it("Second couple array-collection", function(done) {

        var arrayOfIndexes2 = require("./arrayOfIndexes2.json");
        var correctAnswer2 = require("./answer2.json");

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
                        syncIndexes(arrayOfIndexes2, collection, {log: false}, callback);
                    }
                ],
                function(err) {
                    assert.equal(err, null);

                    collection.indexes(function(err, indexes) {
                        assert.equal(err, null);

                        //Verification
                        expect(indexes).to.deep.equal(correctAnswer2);

                        //Close database and finish test
                        db.close();
                        done();
                    });
                }
            );
        });


    });
});

describe("Sync between object of arrays and database.", function() {

    it("First couple object-database", function(done) {

        var arrayOfIndexes3 = require("./arrayOfIndexes3.json");

        MongoClient.connect(url, function(err, db) {
            assert.equal(err, null);

            async.series(
                [
                    // Execute algorithm
                    function(callback) {
                        syncIndexes(arrayOfIndexes3, db, {log: false}, callback);
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