var MongoClient = require("mongodb").MongoClient,
    assert = require("assert"),
    _ = require("lodash"),
    async = require('async');

//TODO: second style (pass db and indexes from multiple collections)

var toIgnoreInArray = ["background", "dropUps"],
    toIgnoreInDatabase = ["v", "ns"],
    toIgnoreIfUndefined = ["name"];

var cleanIndexes = function(indexesToClean, dirty) {
    return _.map(indexesToClean, function(indexToClean) {
        return _.omit(indexToClean, dirty);
    });
};

var dropIndexes = function(indexesToDrop, collection, callback) {

    var tasks = [];

    _.map(indexesToDrop, function(indexToDrop) {
        tasks.push(
            function(_callback) {
                console.log("Dropping index of key " + indexToDrop.key);
                collection.dropIndex(indexToDrop.key, function(err) {
                    if(err) {
                        console.log("Error: " + err.message);
                    }
                    else {
                        console.log("Dropped index " + indexToDrop.name + ".");
                    }

                    _callback();
                });
            }
        )
    });

    async.parallel(
        tasks,
        function(err) {
            assert.equal(err);
            callback();
        }
    );
};

var createIndexes = function(indexesToCreate, collection, callback) {

    var tasks = [];

    _.map(indexesToCreate, function(indexToCreate) {
            tasks.push(
                function(_callback) {
                    console.log("Creating index of key " + indexToCreate.key);
                    collection.createIndex(indexToCreate.key, function(err, indexName) {
                        assert.equal(null, err);

                        console.log("Created index " + indexName + ".");

                        _callback();
                    });
                }
            );
        }
    );

    async.parallel(
        tasks,
        function(err) {
            assert.equal(err);
            callback();
        }
    );
};

var isEqual = function(index1, index2, positionArray, toIgnoreIfUndefined) {

    var indexArray = positionArray == 1 ? index1 : index2,
        indexCollection = positionArray == 1 ? index2 : index1;

    var toIgnore = _.chain(toIgnoreIfUndefined)
        .map(function(_toIgnoreIfUndefined) {
            if(indexArray[_toIgnoreIfUndefined] === undefined) return _toIgnoreIfUndefined;
        })
        .compact()
        .value();

    indexCollection = _.omit(indexCollection, toIgnore);

    return _.isEqual(indexArray, indexCollection);
};

var difference = function(indexes, indexesToKeep, positionArray, toIgnoreIfUndefined) {

    return _.chain(indexes)
        .map(function(index) {

            var presentInArray = false;
            _.map(indexesToKeep, function(indexToKeep) {
                if(isEqual(index, indexToKeep, positionArray, toIgnoreIfUndefined)) presentInArray = true;
            });
            if(!presentInArray) return index;
        })
        .compact()
        .value();
};

//For the moment, collection is a string
var syncIndexes = function(indexesArray, url, collectionName, options, callback) {

    // Use connect method to connect to the Server
    MongoClient.connect(url, function(err, db) {

        assert.equal(null, err);
        console.log("Correctly connected to server. \n");

        var collection = db.collection(collectionName);

        collection.indexes(function(err, indexesCollection) {
            assert.equal(err, null);

            var cleanIndexesCollection = cleanIndexes(indexesCollection, toIgnoreInDatabase);
            var cleanIndexesArray = cleanIndexes(indexesArray, toIgnoreInArray);

            var indexesToDrop = difference(cleanIndexesCollection, cleanIndexesArray, 2, toIgnoreIfUndefined);
            var indexesToCreate = difference(cleanIndexesArray, cleanIndexesCollection, 1, toIgnoreIfUndefined);

            console.log(indexesToDrop);
            console.log(indexesToCreate);

            async.series(
                [
                    function(_callback) {
                        dropIndexes(indexesToDrop, collection, _callback);
                    },
                    function(_callback) {
                        createIndexes(indexesToCreate, collection, _callback);
                    }
                ],
                function(err) {
                    assert.equal(err, null);
                    db.close();
                }
            );

            return callback();
        });

    });
};

module.exports = syncIndexes;
