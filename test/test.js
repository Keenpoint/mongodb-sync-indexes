var MongoClient = require("mongodb").MongoClient,
    syncIndexes = require("../syncIndexes"),
    assert = require("assert"),
    chai = require("chai"),
    expect = chai.expect,
    _ = require("lodash"),
    async = require("async");

// Connection URL
var url = "mongodb://localhost:27017/mocha";

describe("Check sync between first array and collection.", function () {

    it("sss.", function (done) {

        console.log("Test 1\n");

        var arrayOfIndexes1 = require("./arrayOfIndexes1.json");

        MongoClient.connect(url, function (err, db) {
            assert.equal(err, null);

            console.log("Correctly connected to server.\n");

            var collectionName = "mochaCollection1",
                collection = db.collection(collectionName);

            async.series(
                [
                    // Ensure collection exists
                    function (callback) {
                        db.createCollection(collectionName, function (err) {
                            callback(err);
                        });
                    },
                    // Reset database (important so one test doesn't interfere with another)
                    function (callback) {
                        collection.dropIndexes(function (err) {
                            callback(err);
                        });
                    },
                    // Put some indexes in database to test "drop"
                    function (callback) {
                        collection.createIndex({country_name: 1}, function (err) {
                            callback(err);
                        });
                    },
                    // Execute algorithm
                    function (callback) {
                        syncIndexes(arrayOfIndexes1, collection, {log: true}, callback);
                    }
                ],
                function (err) {
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