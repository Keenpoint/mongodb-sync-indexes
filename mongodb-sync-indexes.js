var _ = require("lodash"),
    async = require("async"),
    events = require("events"),
    assert = require("assert");

var toIgnoreInArray = ["background", "dropUps"],
    toIgnoreInDatabase = ["v", "ns"],
    toIgnoreIfUndefined = ["name"];

var syncIndexes = function(indexesArrayOrObject, dbOrCollection, options, mainCallback) {

    var EventHandlerClass = events.EventEmitter,
        eventHandler = new EventHandlerClass();

    // Handlers

    if(options.log !== false) {
        eventHandler.on("error", function(err) {
            console.log(err);
        });

        eventHandler.on("dropIndex", function(key, collection) {
            console.log("Dropping index " + key + " in collection " + collection.s.name + "...");
        });

        eventHandler.on("createIndex", function(key, collection) {
            console.log("Creating index " + key + " in collection " + collection.s.name + "...");
        });

        eventHandler.on("droppedIndex", function(name) {
            console.log("Done. Index dropped has name " + name + "\n");
        });

        eventHandler.on("createdIndex", function(name) {
            console.log("Done. Index created has name " + name + "\n");
        });
    }

    eventHandler.on("done", function() {
        if(mainCallback) return mainCallback();
    });

    // -- Handlers

    var cleanIndexes = function(indexesToClean, dirty) {
        return _.map(indexesToClean, function(indexToClean) {
            return _.omit(indexToClean, dirty);
        });
    };

    var dropIndexes = function(indexesToDrop, collection, callback) {

        var tasks = [];

        _.map(indexesToDrop, function(indexToDrop) {

            tasks.push(function(_callback) {

                eventHandler.emit("dropIndex", JSON.stringify(indexToDrop.key), collection);

                collection.dropIndex(indexToDrop.key, function(err) {

                    if(err) {
                        eventHandler.emit("error", err);
                    }
                    else {
                        eventHandler.emit("droppedIndex", indexToDrop.name);
                    }


                    _callback();
                });
            })
        });

        //async.series in order to get the confirmation messages right
        async.series(
            tasks,
            function() {
                callback();
            }
        );
    };

    var createIndexes = function(indexesToCreate, collection, callback) {

        var tasks = [];

        _.map(indexesToCreate, function(indexToCreate) {
            tasks.push(function(_callback) {

                eventHandler.emit("createIndex", JSON.stringify(indexToCreate.key), collection);

                var options = getOptionsFromCleanIndex(indexToCreate);

                collection.createIndex(indexToCreate.key, options, function(err, indexName) {

                    if(err) {
                        eventHandler.emit("error", err);
                    }
                    else {
                        eventHandler.emit("createdIndex", indexName);
                    }

                    _callback();
                });
            });
        });

        //async.series in order to get the confirmation messages right
        async.series(
            tasks,
            function() {
                callback();
            }
        );
    };

    var isEqual = function(cleanIndexCollection, cleanIndexArray) {

        // toIgnore has the ignorable properties that are defined in our array
        var toIgnore = _.chain(toIgnoreIfUndefined)
            .map(function(_toIgnoreIfUndefined) {
                if(!_.has(cleanIndexArray, _toIgnoreIfUndefined)) return _toIgnoreIfUndefined;
            })
            .compact()
            .value();

        cleanIndexCollection = _.omit(cleanIndexCollection, toIgnore);

        return _.isEqual(cleanIndexCollection, cleanIndexArray);
    };

    var differences = function(cleanIndexesCollection, cleanIndexesArray) {

        return {
            toDrop: function() {
                return _.chain(cleanIndexesCollection)
                    .reject(function(cleanIndexCollection) {
                        var presentInArray = false;

                        _.map(cleanIndexesArray, function(cleanIndexArray) {
                            if(isEqual(cleanIndexCollection, cleanIndexArray)) presentInArray = true;
                        });

                        return presentInArray;
                    })
                    .value();
            },

            toCreate: function() {
                return _.chain(cleanIndexesArray)
                    .reject(function(cleanIndexArray) {

                        var presentInCollection = false;
                        _.map(cleanIndexesCollection, function(cleanIndexCollection) {
                            if(isEqual(cleanIndexCollection, cleanIndexArray)) presentInCollection = true;
                        });

                        return presentInCollection;
                    })
                    .value();
            }
        }
    };

    // Function to ignore index of key {_id: 1} (automatically generated by mongodb, not deletable).
    var ignoreMainIndex = function(indexes) {
        return _.reject(indexes, function(index) {
            //We reject if the expression below is true (the index is the main one).
            return (_.isEqual(index.key, {"_id": 1}));
        });
    };

    // Verifies existence of key in all indexes
    var allIndexesHaveAKey = function(indexesArray) {
        return _.every(indexesArray, "key");
    };

    // A priori, everything that's not the index neither an ignorable property is an option (additional information
    // to create the index).
    var getOptionsFromCleanIndex = function(index) {
        return _.omit(index, "key");
    };

    var checkInitialRequirements = function(indexesArrayOrObject) {
        return indexesArrayOrObject !== undefined
            && indexesArrayOrObject !== null
            && indexesArrayOrObject instanceof Object;
    };

    var checkRequirementsWhenCollection = function(indexesArrayOrObject) {
        return indexesArrayOrObject instanceof Array;
    };

    var checkRequirementsWhenDatabase = function(indexesArrayOrObject) {
        var check = true;

        _.map(indexesArrayOrObject, function(value, collectionName) {
            if(!(value instanceof Array) || typeof collectionName !== "string" || collectionName.length === 0) check = false;
        });

        return check;
    };

    var ensureIndexExistence = function(collection, callback) {
        collection.createIndex({_id: 1}, function(err) {
            callback(err);
        });
    };

    // Start point of the function syncIndexesOneCollection
    var updateOneCollection = function(indexesArray, collection, options, callback) {
        collection.indexes(function(err, indexesCollection) {
            if(err) {
                eventHandler.emit("error", err);
                // Avoid unknown state
                return callback();
            }

            // Clean indexes (ignore secondary properties in both array and collection)
            var cleanIndexesCollection = ignoreMainIndex(cleanIndexes(indexesCollection, toIgnoreInDatabase)),
                cleanIndexesArray = ignoreMainIndex(cleanIndexes(indexesArray, toIgnoreInArray));

            // Get differences between collection and array: define what to drop and what to create
            var diff = differences(cleanIndexesCollection, cleanIndexesArray);

            var indexesToDrop = diff.toDrop(),
                indexesToCreate = diff.toCreate();

            // Drop and create indexes in the collection
            async.series(
                [
                    function(_callback) {
                        dropIndexes(indexesToDrop, collection, _callback);
                    },
                    function(_callback) {
                        createIndexes(indexesToCreate, collection, _callback);
                    }
                ],
                // Errors are handled in functions dropIndexes and createIndex (simply logging them)
                function() {
                    callback();
                }
            );
        });
    };

    var updateCollectionOrDatabase = function(indexesArrayOrObject, dbOrCollection, options) {

        //Check the first two arguments (obligatory)
        assert(checkInitialRequirements(indexesArrayOrObject), "Your first argument is not valid. Please refer to the documentation.");
        assert(dbOrCollection instanceof require("mongodb").Collection
            || dbOrCollection instanceof require("mongodb").Db,
            "Sorry, the second argument given isn't a collection, neither a database.");

        if(dbOrCollection instanceof require("mongodb").Collection) {
            assert(checkRequirementsWhenCollection(indexesArrayOrObject), "Your second argument is a collection, but the first one doesn't respect the norm. Please refer to the documentation.");

            assert(allIndexesHaveAKey(indexesArrayOrObject), "Your array has at least one index without the 'key' property.");

            // By initializing an index, we can call collection.indexes at the beginning of updateOneCollection.
            // So we create the main index (normally created by default).
            async.series(
                [
                    function(_callback) {
                        ensureIndexExistence(dbOrCollection, _callback);
                    }
                ],
                function(err) {
                    assert.equal(err, null, "Sorry, an unexpected error happened when creating/ensuring the default index _id_.");
                    var done = function() {
                        eventHandler.emit("done")
                    };
                    updateOneCollection(indexesArrayOrObject, dbOrCollection, options, done);
                }
            )
        }
        else if(dbOrCollection instanceof require("mongodb").Db) {
            assert(checkRequirementsWhenDatabase(indexesArrayOrObject), "Your second argument is a database, but the first one doesn't respect the norm. Please refer to the documentation.");

            // Create array of collection updates
            var tasks = [];

            _.map(indexesArrayOrObject, function(value, collectionName) {

                assert(allIndexesHaveAKey(value), "Your object has at least one index without the 'key' property.");

                tasks.push(function(_callback) {
                    dbOrCollection.createCollection(collectionName, function(err) {
                        if(err) {
                            eventHandler.emit("error", err);
                        }
                        else {
                            updateOneCollection(value, dbOrCollection.collection(collectionName), options, _callback);
                        }
                    });
                });
            });

            // Update collections asynchronously
            async.parallel(
                tasks,
                function() {
                    eventHandler.emit("done");
                }
            );
        }
    };

    updateCollectionOrDatabase(indexesArrayOrObject, dbOrCollection, options);

    return eventHandler;
};


module.exports = syncIndexes;
