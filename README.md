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

- An object with the desired indexes (cf. object rules)

- The mongodb collection or database to be synchronized. No need to bother with mongodb subtitilities, as: necessity of creating the collection to access its indexes, impossibility of dropping the main index, etc.

- Optionally, pass execution options as an object:
      Name      Type      Default       Description
      log       boolean   true          Controls logging activity in terminal

- Optionally, pass a callback. We don't pass any errors to your callback. The fatal errors (for example, when the first argument that doesn't respect our patterns) will block the execution at the very beginning, while minor problems are simply logged.

All indexes in your object must must have a key! That's the property we use to create and drop them.

```javascript

```
