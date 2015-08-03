var _ = require("lodash"),
    async = require("async"),
    events = require("events");

// TODO: how to avoid repetition when the code uses return callback and we don't want to execute anything after?

// TODO: interrupt execution even without callback

// TODO: error if arrayIndexes isn't in the correct format for db/collection

// TODO avoid overriding properties from mongodb options

var syncIndexes = function(indexesArrayOrObject, dbOrCollection, options, callback) {

    //Handler class definition
    var eventHandlerClass = function() {
        events.EventEmitter.call(this);
    };
    require("util").inherits(eventHandlerClass, events.EventEmitter);

    var eventHandler = new eventHandlerClass();

    // Handlers

    eventHandler.on("error", function(err) {
        if(options !== undefined && options.log) console.log(err);
    });

    eventHandler.on("dropIndex", function(key) {
        if(options !== undefined && options.log) console.log("Dropping index " + key + "... ");
    });

    eventHandler.on("createIndex", function(key) {
        if(options !== undefined && options.log) console.log("Creating index " + key + "... ");
    });

    eventHandler.on("confirmation", function(name) {
        if(options !== undefined && options.log) console.log("Done. Name is " + name + "\n");
    });

    // -- Handlers

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

            tasks.push(function(_callback) {

                eventHandler.emit("dropIndex", JSON.stringify(indexToDrop.key));

                collection.dropIndex(indexToDrop.key, function(err) {

                    if(!err) {
                        eventHandler.emit("confirmation", indexToDrop.name);
                    }

                    _callback(err);
                });
            })
        });

        //async.series in order to get the confirmation messages right
        async.parallel(
            tasks,
            function(err) {
                if(err) {
                    eventHandler.emit("error", err);
                }
                callback(err);
            }
        );
    };

    var createIndexes = function(indexesToCreate, collection, callback) {

        var tasks = [];

        _.map(indexesToCreate, function(indexToCreate) {
            tasks.push(function(_callback) {

                eventHandler.emit("createIndex", JSON.stringify(indexToCreate.key));

                var options = getOptionsFromCleanIndex(indexToCreate);

                collection.createIndex(indexToCreate.key, options, function(err, indexName) {

                    if(!err) {
                        eventHandler.emit("confirmation", indexName);
                    }

                    _callback(err);
                });
            });
        });

        //async.series in order to get the confirmation messages right
        async.series(
            tasks,
            function(err) {
                if(err) {
                    eventHandler.emit("error", err);
                }
                callback(err);
            }
        );
    };

    var isEqual = function(cleanIndexCollection, cleanIndexArray) {

        // toIgnore has the ignorable properties that are defined in our array
        var toIgnore = _.chain(toIgnoreIfUndefined)
            .map(function(_toIgnoreIfUndefined) {
                //TODO use has?
                if(cleanIndexArray[_toIgnoreIfUndefined] === undefined) return _toIgnoreIfUndefined;
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
            if(!(value instanceof Array) || typeof collectionName !== "string" || collectionName.length === 0) {
                check = false;
            }
        });

        return check;
    };

    // Start point of the function syncIndexesOneCollection
    var updateOneCollection = function(indexesArray, collection, options, callback) {
        collection.indexes(function(err, indexesCollection) {
            if(err) {
                eventHandler.emit("error", err);
                return callback(err);
            }

            if(!allIndexesHaveAKey(indexesArray)) {
                var _err = new Error("Your array has at least one index without the 'key' property.");
                eventHandler.emit("error", _err);
                return callback(_err);
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
                function(err) {
                    if(err) {
                        eventHandler.emit("error", err);
                        return callback(err);
                    }
                    else {
                        return callback();
                    }
                }
            );
        });
    };

    var updateCollectionOrDatabase = function(indexesArrayOrObject, dbOrCollection, options, callback) {

        if(!checkInitialRequirements(indexesArrayOrObject)) {
            var _err = new Error("Your first argument is not a valid object. Please refer to the documentation.");
            eventHandler.emit("error", _err);
            return callback(_err);
        }

        //TODO change this hack. Use a more stable way to define if it's collection or db

        // If it's collection
        if(_.has(dbOrCollection, "s.dbName")) {
            // Check if indexesArrayOrObject is an array
            // TODO put in function
            if(!checkRequirementsWhenCollection(indexesArrayOrObject)) {
                var _err = new Error("Your second argument is a collection, but the first one doesn't respect the norm. Please refer to the documentation.");
                eventHandler.emit("error", _err);
                return callback(_err);
            }

            // TODO undo little hack ? create collection if it doesn't exist. otherwise AssertionError: [MongoError: no collection]

            dbOrCollection.createIndex({_id: 1}, function(err) {
                if(err) return callback(err);
                updateOneCollection(indexesArrayOrObject, dbOrCollection, options, callback);
            });
        }
        // If it's database
        else if(_.has(dbOrCollection, "s.databaseName")) {
            // Check if indexesArrayOrObject is an object with the required properties
            if(!checkRequirementsWhenDatabase(indexesArrayOrObject)) {
                var _err = new Error("Your second argument is a database, but the first one doesn't respect the norm. Please refer to the documentation.");
                eventHandler.emit("error", _err);
                return callback(_err);
            }

            var tasks = [];

            _.map(indexesArrayOrObject, function(value, collectionName) {
                tasks.push(function(_callback) {
                    dbOrCollection.createCollection(collectionName, function(err) {
                        if(err) return _callback(err);
                        updateOneCollection(value, dbOrCollection.collection(collectionName), options, _callback);
                    });
                });
            });

            // Update collections asynchronously
            async.series(
                tasks,
                function(err) {
                    if(err) eventHandler.emit("error", err);
                    callback(err);
                }
            );
        }

    };

    updateCollectionOrDatabase(indexesArrayOrObject, dbOrCollection, options, callback);
};


module.exports = syncIndexes;
