# mongodb-sync-indexes

Synchronize the indexes of some mongodb database or collection using an object. Only indexes with different properties are dropped/created, so the changes can be properly logged.

# Installation

```
npm i mongodb-sync-indexes
```

# Usage 

- Require the module

```javascript
var syncIndexes = require('mongodb-sync-indexes');

[...]

var eventHandler = syncIndexes(object, collectionOrDatabase, [options], [callback]);
```

Arguments:

- An object with the desired indexes (cf. "Examples" and "First argument rules")

- The mongodb collection or database to be synchronized. No need to bother with mongodb subtitilities, as: necessity of creating the collection to access its indexes, impossibility of dropping the main index, etc.

- Optionally, pass execution options as an object:
```
      Name              Type              Default           Description
      log               boolean           true              Controls logging activity in terminal
```

- Optionally, pass a callback. We don't pass any errors to your callback. The fatal errors (for example, when the first argument that doesn't respect our patterns) will block the execution at the very beginning, while minor problems are simply logged.

You can also use the event handler returned. He already listens to the following events:
- "dropIndex", "createIndex", "droppedIndex", "createdIndex": for logging purposes
- "done": to end execution, calling a callback if it's defined

# Examples

```javascript
var assert = require("assert"),
    syncIndexes = require('mongodb-sync-indexes');
 
// Normally you'll store this variable in a .json file
var arrayOfIndexes = 
            [
              {
                "key": { // key is mandatory
                  "country": 1
                },
                "unique": true,
                "myPersonalizedProperty": "This will be accepted." // we can create our own properties
              },
              {
                "key": { // key is mandatory
                  "population": 1
                },
                "name": "pop", // if you a specific name, this property becomes important for index comparison
                "sparse": true,
                "w": 1
              }
            ];

MongoClient.connect(url, function(err, db) {
      assert.equal(err, null);
      
      collection = db.collection("myCollection");
      
      collection.createIndex({country_name: 1}, function(err) {
            assert.equal(err, null);
            
            syncIndexes(arrayOfIndexes, collection);
      }
}
```

In the shell you'll see the following
```
Dropping index {"country_name":1} in collection myCollection...
Done. Index dropped has name country_name_1

Creating index {"country":1} in collection myCollection...
Done. Index created has name country_1

Creating index {"population":1} in collection myCollection...
Done. Index created has name pop
```

Finally, in your collection, the indexes stored like this:

```
[
  {
    "key": {
      "_id": 1
    },
    "name": "_id_",
    "ns": "test.myCollection",
    "v": 1
  },
  {
    "key": {
      "country": 1
    },
    "myPersonalizedProperty": "This will be accepted.",
    "name": "country_1",
    "ns": "test.myCollection",
    "unique": true,
    "v": 1
  },
  {
    "key": {
      "population": 1
    },
    "name": "pop",
    "ns": "test.myCollection",
    "sparse": true,
    "v": 1
  }
]
```

# First argument rules
