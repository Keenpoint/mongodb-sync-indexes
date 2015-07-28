'use strict';

var syncIndexes = require('../syncIndexes');
var chai = require ('chai');
var expect = chai.expect;
//var _ = require('lodash');

describe('Check sync between first array and collection.', function () {

    it('Delete from collection indexes absent in array.', function (done) {

        //Verification
        expect(result).to.deep.equal(correctAnswer);

        done();
    });

    it('Insert in collection indexes present in array but not in collection.', function (done) {

        //Verification
        expect(result).to.deep.equal(correctAnswer);

        done();
    });
});