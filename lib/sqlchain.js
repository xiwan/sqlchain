(function(){
	var mysql = require('mysql');
	var root = this;
	var sqlchain = {
		sqlQ: [],
		err: "ok"
	};
	if (typeof module !== 'undefined' && module.exports) {
        module.exports = sqlchain;
    }else {
    	root.sqlchain = sqlchain;
    }

	sqlchain.config = _(function(cf){
		this.cf = cf;
		this.sqlQ.length = 0;
	});

	sqlchain.db = _(function(db){
		this.db = db;
		this.sqlQ.length = 0;
	});

	sqlchain.table = _(function(tb){
		this.tb = tb;
		this.sqlQ.length = 0;
	});

	sqlchain.pool = _(function(cf){
		if (this.pl) {this.pl = null;}
		this.pl = mysql.createPool(cf||this.cf); // extends old and new config here
	});

	sqlchain.select = _(function(cols){

	});

	sqlchain.where = _(function(){

	});

	sqlchain.insert = _(function(object){
		var objArr = _isArray(object) ? object : [object] ;
		var arrVal = [];
		var arrKey = [];
		_parser(objArr, arrKey, arrVal);
		this.sql = 'INSERT INTO ' + this.tb + ' (';
		for (var i = 0, len = arrKey[0].length; i<len; i++) {
			this.sql += arrKey[0][i] + ',';
		}
		this.sql = this.sql.replace(new RegExp(',$'), '');
		this.sql += ') ';
		this.sql += 'VALUES ';
		for (var i = 0, len = arrVal.length; i<len; i++) {
			this.sql += '(';
			for (var j = 0, _len = arrVal[i].length; j<_len; j++) {
				var val = arrVal[i][j];
				if (_isString(val)) {
					val = '"' + val + '"';
				}
				this.sql += val + ',';
			}
			this.sql = this.sql.replace(new RegExp(',$'), '');
			this.sql += '),';
		}
		this.sql = this.sql.replace(new RegExp(',$'), '');
		this.sql += ";";
		this.sqlQ.push(this.sql);
	});

	sqlchain.run = function(sqlOrFunc, func){
		if (_isFunction(sqlOrFunc)) {
			var sqlE = this.sqlQ.join("\n");
			console.log(sqlE, "\n");
			_exec(this.pl, this.sqlE, this.err);
			sqlOrFunc(this.err);
		}else if(_isString(sqlOrFunc)) {
			_exec(this.pl, sqlOrFunc, this.err);
			if (_isFunction(func)){
				func(this.err);
			}
		}else{
			// throw err here!!!
		}
	};

    function _(func){
    	return function(){
    		func.apply(sqlchain, arguments);
    		return sqlchain;
    	}
    }

	function _exec(pl, sql, err) { 
		pl.getConnection(function(err, connection){
			connection.query(sqlchain.sql, function(error, rows){
				if (error) {err=error}
				connection.release();
			});
		});
	}

	function _parser( obj, arrKey, arrVal ) {
		if ( _isArray(obj) ) {
			var len = obj.length;
			var i = 0;
			while (i<len){
				var _arrKey = [];
				var _arrVal = [];
				arguments.callee.apply(this, [obj[i++], _arrKey, _arrVal]);
				arrKey.push(_arrKey);
				arrVal.push(_arrVal);
			}
		}else if ( _isObject(obj) ) {
			for (var key in obj) {
			  	if ( obj.hasOwnProperty(key) ) {
			  		var _obj = obj[key];
			  		//console.log(key, "->", _obj);
			  		if ( _obj == null) continue;
			  		if ( _isObject(_obj) ) {
			  			arguments.callee.apply(this, [_obj, arrKey, arrVal]);
			  		}else if ( _isArray(_obj) ) {
			  			// array not handle here
			  		}else if ( _isString(_obj) || _isNumber(_obj) ) {
			  			arrKey.push(key);
			  			arrVal.push(_obj);
			  		}
			  	}
			}
		}
	}

	function _isFunction() {
		return (typeof arguments[0] === 'function');
	}
	function _isString() {
		return (typeof arguments[0] === 'string');
	}
	function _isObject() {
		return (arguments[0].constructor === Object && !arguments[0].hasOwnProperty('length'));
	}
	function _isArray() {
		return (arguments[0].constructor === Array);
	}
	function _isNumber() {
		return (!isNaN(parseFloat(arguments[0])));
	}
})();