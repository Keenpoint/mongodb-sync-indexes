var MongoClient = require("mongodb").MongoClient,
    syncIndexes = require("../mongodb-sync-indexes"),
    assert = require("assert"),
    async = require("async");

// Connection URL
var url = "mongodb://localhost:27017/test";

// To globally access the database
var db;

var options = {};

// Drop collections and store database in global variable
before(function(done) {
    MongoClient.connect(url, function(err, db_) {
        assert.equal(err, null);

        db = db_;

        async.series(
            [
                function(callback) {//TODO: put the collections in a var and iterate over it in before() and after()
                    db.createCollection("mongodbSyncIndexesCollection1", function(err) {
                        assert.equal(err, null);
                        db.dropCollection("mongodbSyncIndexesCollection1", function(err) {
                            callback(err);
                        });
                    })
                },
                function(callback) {
                    db.createCollection("mongodbSyncIndexesCollection2", function(err) {
                        assert.equal(err, null);
                        db.dropCollection("mongodbSyncIndexesCollection2", function(err) {
                            callback(err);
                        });
                    });
                },
                function(callback) {
                    db.createCollection("mongodbSyncIndexesCollection3", function(err) {
                        assert.equal(err, null);
                        db.dropCollection("mongodbSyncIndexesCollection3", function(err) {
                            callback(err);
                        });
                    });
                },
                function(callback) {
                    db.createCollection("mongodbSyncIndexesCollection4", function(err) {
                        assert.equal(err, null);
                        db.dropCollection("mongodbSyncIndexesCollection4", function(err) {
                            callback(err);
                        });
                    });
                }
            ],
            function(err) {
                assert.equal(err, null);
                done();
            }
        );
    });
});

describe("Sync between array and collection", function() {

    it("First couple array-collection", function(done) {

        var arrayOfIndexes1 = require("./arrayOfIndexes1.json");
        var correctAnswer1 = require("./answer1.json");

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
                    syncIndexes(arrayOfIndexes1, collection, options, callback);
                }
            ],
            function(err) {
                assert.equal(err, null);
                collection.indexes(function(err, indexes) {
                    assert.equal(err, null);

                    //Verification
                    assert.deepEqual(indexes, correctAnswer1);

                    done();
                });
            }
        );
    });

    it("Second couple array-collection", function(done) {

        var arrayOfIndexes2 = require("./arrayOfIndexes2.json");

        var correctAnswer2 = require("./answer2.json");

        var collectionName = "mongodbSyncIndexesCollection2",
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
                    //Another way to call the main function:
                    var eventHandler = syncIndexes(arrayOfIndexes2, collection, options);
                    eventHandler.on("done", function() {
                        callback();
                    });
                }
            ],
            function(err) {
                assert.equal(err, null);

                collection.indexes(function(err, indexes) {
                    assert.equal(err, null);

                    //Verification
                    assert.deepEqual(indexes, correctAnswer2);

                    done();
                });
            }
        );
    });
});

describe("Sync between object of arrays and database", function() {

    it("First couple object-database", function(done) {

        var arrayOfIndexes3and4 = require("./arrayOfIndexes3and4.json");

        var correctAnswer3 = require("./answer3.json"),
            correctAnswer4 = require("./answer4.json");

        async.series(
            [
                // Execute algorithm
                function(callback) {
                    syncIndexes(arrayOfIndexes3and4, db, options, callback);
                }
            ],
            function(err) {
                assert.equal(err, null);

                db.collection("mongodbSyncIndexesCollection3").indexes(function(err, indexesInCollection3) {
                    assert.equal(err, null);

                    //Verification
                    assert.deepEqual(indexesInCollection3, correctAnswer3);

                    db.collection("mongodbSyncIndexesCollection4").indexes(function(err, indexesInCollection4) {
                        assert.equal(err, null);

                        //Verification
                        assert.deepEqual(indexesInCollection4, correctAnswer4);

                        done();
                    });
                });
            }
        );
    });
});

// Drop collections
after(function() {
    async.parallel(
        [
            function(callback) {
                db.dropCollection("mongodbSyncIndexesCollection1", function(err) {
                    callback(err);
                });
            },
            function(callback) {
                db.dropCollection("mongodbSyncIndexesCollection2", function(err) {
                    callback(err);
                });
            },
            function(callback) {
                db.dropCollection("mongodbSyncIndexesCollection3", function(err) {
                    callback(err);
                });
            },
            function(callback) {
                db.dropCollection("mongodbSyncIndexesCollection4", function(err) {
                    callback(err);
                });
            }
        ],
        function(err) {
            assert.equal(err, null);
            db.close();
        }
    );
});