/**
 * FastBitSet.js : a fast bit set implementation in JavaScript.
 * (c) the authors
 * Licensed under the Apache License, Version 2.0.
 *
 * Speed-optimized BitSet implementation for modern browsers and JavaScript engines.
 *
 * A BitSet is an ideal data structure to implement a Set when values being stored are
 * reasonably small integers. It can be orders of magnitude faster than a generic set implementation.
 * The FastBitSet implementation optimizes for speed, leveraging commonly available features
 * like typed arrays.
 *
 * Simple usage :
 *
 *  var b = new FastBitSet();// initially empty
 *         // will throw exception if typed arrays are not supported
 *  b.add(1);// add the value "1"
 *  b.has(1); // check that the value is present! (will return true)
 *  b.add(2);
 *  console.log(""+b);// should display {1,2}
 *  b.add(10);
 *  b.array(); // would return [1,2,10]
 *
 *  var c = new FastBitSet([1,2,3,10]); // create bitset initialized with values 1,2,3,10
 *  c.difference(b); // from c, remove elements that are in b
 *  var su = c.union_size(b);// compute the size of the union (bitsets are unchanged)
 * c.union(b); // c will contain all elements that are in c and b
 * var s1 = c.intersection_size(b);// compute the size of the intersection (bitsets are unchanged)
 * c.intersection(b); // c will only contain elements that are in both c and b
 * c = b.clone(); // create a (deep) copy of b and assign it to c.
 * c.equals(b); // check whether c and b are equal
 *
 */
"use strict";

function isIterable(obj) {
    if (obj == null) {
        return false;
    }
    return obj[Symbol.iterator] !== undefined;
}
// you can provide an iterable
// an exception is thrown if typed arrays are not supported
function FastBitSet (iterable) {
    if(typeof Uint32Array === 'function') {
        this.count = 0|0;
        if(Number.isInteger(iterable)) {
            this.words = new Uint32Array(iterable);
        } else if(isIterable(iterable)) {
            this.words = new Uint32Array(4);
            for (var key of iterable) {
                this.add(key);
            }
        } else {
            this.words = new Uint32Array(0);
        }
    } else {
        console.log("Your JavaScript engine does not support typed arrays.");
        throw "Uint32Array unsupported";
    }
}
FastBitSet.prototype[Symbol.iterator] = 1;



FastBitSet.prototype.WORD_SIZE = 32|0;
FastBitSet.prototype.LOG_WORD_SIZE = 5|0;



// Add the value (Set the bit at index to true)
FastBitSet.prototype.add = function(index) {
    if((this.count << 5) <= index) {
        this.resize(index);
    }
    this.words[index >> 5] |= 1 << index ;
};


// If the value was not in the set, add it, otherwise remove it (flip bit at index)
FastBitSet.prototype.flip = function(index) {
    if((this.count << 5) <= index) {
        this.resize(index);
    }
    this.words[index >> 5] ^= 1 << index ;
};

// Remove all values, reset memory usage
FastBitSet.prototype.clear = function() {
    this.count = 0|0;
    this.words = new Uint32Array(count);
};


// Set the bit at index to false
FastBitSet.prototype.remove = function(index) {
    if((this.count  << 5) <= index) {
        this.resize(index);
    }
    this.words[index  >> 5] &= ~(1 << index);
};

// Return true if no bit is set
FastBitSet.prototype.isEmpty = function(index) {
    var c = this.count;
    for(var  i = 0; i < c; i++) {
        if(this.words[i] !== 0) return false;
    }
    return true;
};


// Is the value contained in the set? Is the bit at index true or false? Returns a boolean
FastBitSet.prototype.has = function(index) {
    return (this.words[index  >> 5] & (1 << index)) !== 0;
};

// Resize the bitset so that we can write a value at index
FastBitSet.prototype.resize = function(index) {
    if((this.count  << 5) > index) {
        return; //nothing to do
    }
    this.count = (index + 32) >> 5;// just what is needed
    if((this.words.length  << 5) <= index) {
        var newwords;
        try {
            newwords = new Uint32Array(this.count << 1); // we first try to allocate more
        } catch(e) {
            newwords = new Uint32Array(this.count); // if it fails, allocate just what is needed
        }
        newwords.set(this.words);// hopefully, this copy is fast
        this.words = newwords;
    }
};


// fast function to compute the Hamming weight of a 32-bit unsigned integer
FastBitSet.prototype.hamming_weight = function(v) {
    v -= ((v >> 1) & 0x55555555);
    v = (v & 0x33333333) + ((v >> 2) & 0x33333333);
    return ((v + (v >> 4) & 0xF0F0F0F) * 0x1010101) >> 24;
}

// How many values stored in the set? How many set bits?
FastBitSet.prototype.size = function() {
    var answer = 0;
    var c = this.count;
    for (var i = 0; i < c; i++) {
        answer += this.hamming_weight(this.words[i] | 0);
    }
    return answer;
};

// Return an array with the set bit locations (values)
FastBitSet.prototype.array = function() {
    var answer = new Array(this.size());
    var pos = 0|0;
    var c = this.count|0;
    for (var k = 0; k < c; ++k) {
        var w =  this.words[k];
        while (w != 0) {
            var t = w & -w;
            answer[pos++] = (k << 5) + this.hamming_weight((t - 1)|0);
            w ^= t;
        }
    }
    return answer;
};


// Return an array with the set bit locations (values)
FastBitSet.prototype.forEach = function(fnc) {
    var c = this.count|0;
    for (var k = 0; k < c; ++k) {
        var w =  this.words[k];
        while (w != 0) {
            var t = w & -w;
            fnc( (k << 5) + this.hamming_weight((t - 1)|0));
            w ^= t;
        }
    }
};


// Creates a copy of this bitmap
FastBitSet.prototype.clone = function() {
    var clone = Object.create(FastBitSet.prototype);
    clone.count = this.count;
    clone.words = new Uint32Array(this.words);
    return clone;
};


// Computes the intersection between this bitset and another one,
// the current bitmap is modified  (and returned by the function)
FastBitSet.prototype.intersection = function(otherbitmap) {
    var newcount = Math.min(this.count,otherbitmap.count);
    for (var k = 0|0; k < newcount; ++k) {
        this.words[k] &= otherbitmap.words[k];
    }
    var c = this.count;
    for (var k = newcount; k < c; ++k) {
        this.words[k] = 0;
    }
    this.count = newcount;
    return this;
};

// Computes the size of the intersection between this bitset and another one
FastBitSet.prototype.intersection_size = function(otherbitmap) {
    var newcount = Math.min(this.count,otherbitmap.count);
    var answer = 0|0;
    for (var k = 0|0; k < newcount; ++k) {
        answer += this.hamming_weight(this.words[k] & otherbitmap.words[k]);
    }
    return answer;
};

// Computes the intersection between this bitset and another one,
// a new bitmap is generated
FastBitSet.prototype.new_intersection = function(otherbitmap) {
    var answer = Object.create(FastBitSet.prototype);
    answer.count = Math.min(this.count,otherbitmap.count);
    answer.words = new Uint32Array(answer.count);
    var c = answer.count;
    for (var k = 0|0; k < c; ++k) {
        answer.words[k] = this.words[k] & otherbitmap.words[k];
    }
    return answer;
};

// Computes the intersection between this bitset and another one,
// the current bitmap is modified
FastBitSet.prototype.equals = function(otherbitmap) {
    var mcount = Math.min(this.count , otherbitmap.count)
    for (var k = 0|0; k < mcount; ++k) {
        if(this.words[k] != otherbitmap.words[k]) return false;
    }
    if(this.count < otherbitmap.count) {
        var c = otherbitmap.count;
        for (var k = this.count; k < c; ++k) {
            if(otherbitmap.words[k] != 0) return false;
        }
    } else if (otherbitmap.count < this.count) {
        var c = this.count;
        for (var k = otherbitmap.count; k < c; ++k) {
            if(this.words[k] != 0) return false;
        }
    }
    return true;
};


// Computes the difference between this bitset and another one,
// the current bitset is modified (and returned by the function)
FastBitSet.prototype.difference = function(otherbitmap) {
    var newcount = Math.min(this.count,otherbitmap.count);
    for (var k = 0|0; k < newcount; ++k) {
        this.words[k] &= ~otherbitmap.words[k];
    }
    return this;
};



// Computes the size of the difference between this bitset and another one
FastBitSet.prototype.difference_size = function(otherbitmap) {
    var newcount = Math.min(this.count,otherbitmap.count);
    var answer = 0|0;
    var k = 0|0;
    for (; k < newcount; ++k) {
        answer += this.hamming_weight(this.words[k] & (~otherbitmap.words[k]));
    }
    var c = this.count;
    for(; k < c; ++k) {
        answer += this.hamming_weight(this.words[k]);
    }
    return answer;
};

// Returns a string representation
FastBitSet.prototype.toString = function() {
    return "{"+this.array().join(",")+"}";
};

// Computes the union between this bitset and another one,
// the current bitset is modified  (and returned by the function)
FastBitSet.prototype.union = function(otherbitmap) {
    var mcount = Math.min(this.count,otherbitmap.count);
    for (var k = 0|0; k < mcount; ++k) {
        this.words[k] |= otherbitmap.words[k];
    }
    if(this.count < otherbitmap.count) {
        this.resize((otherbitmap.count  << 5) - 1);
        var c = otherbitmap.count;
        for (var k = mcount; k < c; ++k) {
            this.words[k] = otherbitmap.words[k];
        }
        this.count = otherbitmap.count;
    }
    return this;
};

// Computes the union between this bitset and another one,
// a new bitmap is generated
FastBitSet.prototype.new_union = function(otherbitmap) {
    var answer = Object.create(FastBitSet.prototype);
    answer.count = Math.max(this.count,otherbitmap.count);
    answer.words = new Uint32Array(answer.count);

    var mcount = Math.min(this.count,otherbitmap.count)
    for (var k = 0; k < mcount; ++k) {
        answer.words[k] = this.words[k] | otherbitmap.words[k];
    }
    var c = this.count;
    for (var k = mcount; k < c; ++k) {
        answer.words[k] = this.words[k] ;
    }
    var c2 = otherbitmap.count;
    for (var k = mcount; k < c2; ++k) {
        answer.words[k] = otherbitmap.words[k] ;
    }
    return answer;
};


// Computes the difference between this bitset and another one,
// a new bitmap is generated
FastBitSet.prototype.new_difference = function(otherbitmap) {
    return this.clone().difference(otherbitmap);// should be fast enough
};


// Computes the size union between this bitset and another one
FastBitSet.prototype.union_size = function(otherbitmap) {
    var mcount = Math.min(this.count,otherbitmap.count);
    var answer = 0|0;
    for (var k = 0|0; k < mcount; ++k) {
        answer += this.hamming_weight(this.words[k] | otherbitmap.words[k]);
    }
    if(this.count < otherbitmap.count) {
        var c = otherbitmap.count;
        for(var k = this.count ; k < c; ++k) {
            answer += this.hamming_weight(otherbitmap.words[k]|0);
        }
    } else {
        var c = this.count;
        for(var k = otherbitmap.count ; k < c; ++k) {
            answer += this.hamming_weight(this.words[k]|0);
        }
    }
    return answer;
};


module['exports'] = FastBitSet;
