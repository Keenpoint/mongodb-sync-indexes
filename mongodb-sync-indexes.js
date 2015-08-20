var _ = require("lodash"),
    async = require("async"),
    events = require("events"),
    assert = require("assert");

var toIgnoreInArray = ["background", "dropUps"],
    toIgnoreInDatabase = ["v", "ns"],
    toIgnoreIfUndefined = ["name"];

var isArrayOfIndexes = function(arrayOfIndexes) {
    var isArrayOfObjects = _.isArray(arrayOfIndexes) && ! arrayOfIndexes.some(function(index) {
            return ! _.isPlainObject(index);
    });
    if(isArrayOfObjects) assert(_.every(arrayOfIndexes, "key"), "Your array has at least one index without the 'key' property");
    return isArrayOfObjects;
};

var infoByEvent = {
    createIndex: "Creating index %s",
    createdIndex: "Index %s created",
    dropIndex: "Dropping index %s",
    droppedIndex: "Index %s dropped"
};

//TODO: move all function declarations outside of syncIndexes
var syncIndexes = function(indexesArrayOrObject, dbOrCollection, options, mainCallback) {
    options = _.defaults(options, {
        log: true,
        verbose: false
    });

    var EventHandlerClass = events.EventEmitter,
        eventHandler = new EventHandlerClass();

    // Handlers

    if(options.log) {
    _.forEach(infoByEvent, function(eventInfo, event) {
            eventHandler.on(event, function(collection, index) {
                var indexData = event === "createIndex" ? ("with key " + JSON.stringify(index.key)) : index.name;

                console.log("[Collection %s][%s\t] " + eventInfo, collection.s.name, event, indexData);
            });
        });

        eventHandler.on("error", function(err) {
            console.log(err);
        });

        eventHandler.on("done", function() {
            console.log("Finished synchronization.\n\n");
        });
    }

    if(mainCallback) eventHandler.on("done", mainCallback);

    // -- Handlers

    var verboseMsg = function(msg, options) {
        if(options !== undefined && options.verbose) console.log(msg);
    };

    var cleanIndexes = function(indexesToClean, dirty) {
        return _.map(indexesToClean, function(indexToClean) {
            return _.omit(indexToClean, dirty);
        });
    };

    var dropIndexes = function(indexesToDrop, collection, callback) {//TODO: inspire your code from

        var tasks = [];

        _.map(indexesToDrop, function(indexToDrop) {

            tasks.push(function(_callback) {

                eventHandler.emit("dropIndex", collection, indexToDrop, options);

                collection.dropIndex(indexToDrop.key, function(err) {

                    err ? eventHandler.emit("error", err) :
                        eventHandler.emit("droppedIndex", collection, indexToDrop, options);

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

                eventHandler.emit("createIndex", collection, indexToCreate, options);

                var optionsInCreation = getOptionsFromCleanIndex(indexToCreate);

                collection.createIndex(indexToCreate.key, optionsInCreation, function(err, indexName) {//TODO: getIndex(indexName) pour avoir l'index créé

                    err ? eventHandler.emit("error", err) :
                        eventHandler.emit("createdIndex", collection, indexToCreate, options);

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

    var checkInitialRequirements = function(indexesArrayOrObject) {//TODO: wouldn't the last test be sufficient? If yes, don't make a function for that
        return indexesArrayOrObject !== undefined
            && indexesArrayOrObject !== null
            && indexesArrayOrObject instanceof Object;
    };

    var checkRequirementsWhenCollection = function(indexesArrayOrObject) {//TODO: don't make a function for that
        return indexesArrayOrObject instanceof Array;
    };

    var checkRequirementsWhenDatabase = function(indexesArrayOrObject) {
        var check = true;

        _.map(indexesArrayOrObject, function(value, collectionName) {//todo: could have been replaced with one-liner _.some(). But seems better to thow inside loop. If we don't use the output of loop, use forEach instead of map.
            if(!(value instanceof Array) || typeof collectionName !== "string" || collectionName.length === 0) check = false;
        });

        return check;
    };

    // By initializing an index, we can call collection.indexes at the beginning of updateOneCollection.
    // So we create the main index (normally created by default).
    var ensureIndexExistence = function(collection, callback) {
        collection.createIndex({_id: 1}, function(err) {
            callback(err);
        });
    };

    var done = function() {
        eventHandler.emit("done");
    };

    // Start point of the function syncIndexesOneCollection
    var updateOneCollection = function(indexesArray, collection, callback) {
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
                function() {//TODO: insert callback directly
                    callback();
                }
            );
        });
    };

    var updateCollectionOrDatabase = function(indexesArrayOrObject, dbOrCollection) {
        if(dbOrCollection instanceof require("mongodb").Collection) {
            assert(isArrayOfIndexes(indexesArrayOrObject), "Your second argument is a collection, so your first argument must be an array of indexes");

            async.series([
                function(callback) {
                    ensureIndexExistence(dbOrCollection, callback);
                },
                function(callback) {
                    updateOneCollection(indexesArrayOrObject, dbOrCollection, callback);
                }
            ], done);
        }
        else if(dbOrCollection instanceof require("mongodb").Db) {
            assert(_.isPlainObject(indexesArrayOrObject) && _.every(indexesArrayOrObject, isArrayOfIndexes), "Your second argument is a database, so your first argument must be an object where keys are collection and values are arrays of indexes");

            //// Create array of collection updates
            //var tasks = [];
            //
            //_.map(indexesArrayOrObject, function(value, collectionName) {
            //
            //    assert(allIndexesHaveAKey(value), "Your object has at least one index without the 'key' property.");
            //
            //    tasks.push(function(_callback) {
            //        dbOrCollection.createCollection(collectionName, function(err) {
            //            if(err) {
            //                eventHandler.emit("error", err);
            //            }
            //            else {
            //                updateOneCollection(value, dbOrCollection.collection(collectionName), _callback);
            //            }
            //        });
            //    });
            //});
            //
            //// TODO: Update collections asynchronously. Problem: messages are messy with different collections
            //async.series(
            //    tasks,
            //    function() {
            //        eventHandler.emit("done");
            //    }
            //);

            async.forEachOf(indexesArrayOrObject, function(value, collectionName, callback) {
                dbOrCollection.createCollection(collectionName, function(err) {
                    if(err) eventHandler.emit("error", err);
                    else updateOneCollection(value, dbOrCollection.collection(collectionName), callback);
                });
            }, done);
        }
        else throw new Error("The second argument must be a mongo collection or database");
    };

    updateCollectionOrDatabase(indexesArrayOrObject, dbOrCollection);

    return eventHandler;
};

module.exports = syncIndexes;
