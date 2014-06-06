# sqlchain (in-Dev)

Being tired of concating a giant sql and throw it to the query?! Look at a terrible example below:

```javascript
	var insertSQL = 'INSERT INTO geoCoder (address, city, location_lat, location_lng, precise, confidence, level, cityCode, district, province, street, street_number, formatted_address, business)';
	insertSQL += 'VALUES ("'+address+'", "'+city+'", '+location_lat+', '+location_lng+', '+precise+', '+confidence+', "'+level+'", '+cityCode+', "'+district+'", "'+province+'", "'+street+'", "'+street_number+'", "'+formatted_address+'", "'+business+'")';	

	connection.query(insertSQL, function(err, rows){
		if (err) {throw err;}
		connection.release();
	});

```

By slqchain, every line of sql is so well formatted in chaining style. Why not try an elegent solution:

```javascript
	var geoCoder = { 
		address: '三国城',
  		city: '无锡',
		location_lat: 31.481714090036,
		location_lng: 120.23922778783,
		precise: 0,
		confidence: 25,
		level: '',
		cityCode: 317,
		district: '滨湖区',
		province: '江苏省',
		street: '山水西路',
		street_number: '',
		formatted_address: '江苏省无锡市滨湖区山水西路',
		business: '' 
  	};

	sqlchain
		.table("geoCoder")
	    .insert(geoCoder)
	    .run();

```

## 下载

可以通过`git`来获取源代码：

[GitHub - sqlchain](https://github.com/xiwan/sqlchain)

同样，也可以使用`npm`来安装：

	npm install sqlchain

注意：请同时安装mysql的module 

[GitHub - mysql](https://github.com/felixge/node-mysql)

## 一些例子

### 引入包

```javascript
	var sqlchain = require('sqlchain');
```

### 连接数据库

关于数据库的配置文件，可以查看mysql模块的文档

```javascript
	sqlchain.pool({
		host: 'localhost',
		user: 'root',
		password: 'root',
		database: 'database'
	});
```
### 显示数据库

```javascript
	sqlchain.db(function(err, data){}); // SHOW DATABASES

	sqlchain.db('travelpath'); // USE travelpath
```

### 建立表格

### 查询表格

```javascript
	sqlchain.table(function(err, data){}); // SHOW TABLES;

	sqlchain
		.table('location')
		.find() // 因为这里是查找所有列， find 方法也可以省略
		.filter( {"id": 1}, {"area_id": {"$gte": 100, "$ne": 30000}, "cname": {"$like": "%beijing%"}} )
		.run(function(err, data){}); 

	/* 	SELECT * 
		FROM location 
		WHERE (id = 1) OR 
			(area_id >= 100 AND area_id != 30000 AND cname LIKE '%beijing%') */

	sqlchain
		.table('location')
		.count()
		.run(function(err, data){});

	// SELECT COUNT(*) FROM location;

	sqlchain
		.table('location')
		.find("id, area_id, cname, lng, lat")
		.group("cname")
		.desc("id")
		.limit(5, 10)
		.run(function(err, data){});

	/* 与之相对应生成的sql为
	   SELECT id, area_id, cname, lng, lat
	   FROM location
	   GROUP BY cname
	   ORDER BY id DESC
	   LIMIT 5, 10; */
```

#### filter使用规则

##### 符号对应关系

```text
	$eq			: 	=
	$ne 		:	!=
	$lt 		: 	<
	$gt 		:   >
	$lte 		:	<=
	$gte 		:   >=
	$in 		:   IN
	$ni     	:	NOT IN
	$like       :   LIKE %...%

```

##### 逻辑关系

{...} 对象内属于 AND 关系

```javascript
	.filter( {"id":1, "name":"xiwan"} ) 
		// id=1 AND name='xiwan'
```

{...} 对象间属于 OR 关系

```javascript
	.filter( {"id": {"$ne": 1}}, {"name":{"$like", "xiwan"}} ) 
		// id!=1 OR name LIKE '%xiwan%'

	.filter( {{"id":{"$in", [1, 2, 3, 4, 5, 6]}} )
	.filter( {"name":{"$like", "xiwan"} ) 
		// id IN (1,2,3,4,5,6) OR name LIKE '%xiwan%'
```

复合使用

```javascript	
	.filter( {"id":[{$gt: 1}, {$lt: 10}], "name":"xiwan"} ) 
		// (id>1 OR id<10) AND name='xiwan'

	.filter( {"id":{$gt: 1, $lt: 10}}, {"name":"xiwan"} ) 
		// (id>1 AND id<10) OR name='xiwan'
```

#### 如何排序

```javascript
	.sort(); // 默认 id 倒序 DESC
	.sort("cname", true) // 正序 ASC
	.desc("date")
	.asc("date")
```

### 插入数据

```javascript
	var location = {};
	location.area_id = 317;
	location.cname = "北京市";
	location.lng = 116.321706230000;
	location.lat = 39.976118846381;

	sqlchain
		.table('location')
		.insert(location)
		.run(function(err, data){});
```

当然，上面的写法也支持一次插入多条数据:)

```javascript
	sqlchain
		.table('location')
		.insert([location1, location2, ... ])
		.run(function(err, data){});
```

### 更新数据

```javascript
	sqlchain
	    .table('location')
	    .update({"cname": "上海"})
	    .filter({"id": 1})
	    .run(function(err, data){});

	/*
	UPDATE location 
	SET cname= "上海"
	WHERE id = 1;
	*/
```

### 删除数据

```javascript
	sqlchain
	    .table('location')
	    .delete({"id": {"$lte": 10}})
	    .run(function(err, data){});

	/*
	DELETE FROM location 
	WHERE id <= 10;
	*/
```

### 事务支持 (0.2.0)

你要做的其实很简单，把需要执行的sql，放在 begin 和 commit/rollback 之间就可以了

```javascript

	sqlchain
		.begin(function(){
			sqlchain
				.table('geocoder')
				.delete({"id": {"$lte": 10}})
				.run(function(){
					sqlchain.commit(function(){}); // replace 'commit' with 'rollback', if dont want to commit.
				});
		});

```

Still disgusting about all these callback stacks，you can also use [GitHub - async](https://github.com/caolan/async) to make it more beautiful：

```javascript

	async.waterfall([
		function(callback) {
			sqlchain
				.begin(callback);
		},
		function(data, callback) {
			sqlchain
				.table('table1')
				.insert(data)
				.run(callback);
		},
		function(data, callback) {
			sqlchain
				.table('table2')
				.delete({"id": 1})
				.run(callback);
		},
	], function(err, results){
		sqlchain
			.commit(function(err){
				// conintinue 
			});

	});

```

### 其他特性

支持直接sql

```javascript
	sqlchain.run('SELECT * FROM location', function(err, data){});
```

补充sql

```javascript
	sqlchain
		.table('location')
		.append("WHERE id>1 AND id<=10")
		.run(function(err, data){});

	sqlchain
		.table('location')
		.filter("id>1 AND id<=10")
		.run(function(err, data){});
```

