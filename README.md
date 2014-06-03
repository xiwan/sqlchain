# sqlchain

nodejs module: write chaining sql and execute it

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
	sqlchain.db(); // SHOW DATABASES
	sqlchain.db('travelpath'); // USE travelpath
```

### 建立表格

### 查询表格

```javascript
	sqlchain.table(); // SHOW TABLES;

	sqlchain.table('location').find().run(callback); // SELECT * FROM location

	sqlchain
		.table('location')
		.find("id, area_id, cname, lng, lat")
		.group("cname")
		.desc("id")
		.limit(5, 10)
		.run(callback);

	/* 与之相对应生成的sql为
	   SELECT id, area_id, cname, lng, lat
	   FROM location
	   GROUP BY cname
	   ORDER BY id DESC
	   LIMIT 5, 10;*/
```

### 插入表格

```javascript
	var location = {};
	location.area_id = 317;
	location.cname = "北京市";
	location.lng = 116.321706230000;
	location.lat = 39.976118846381;

	sqlchain
		.table('location')
		.insert(location)
		.run(callback);
```

当然，上面的写法也支持一次插入多条数据:)

```javascript
	sqlchain
		.table('location')
		.insert([location1, location2, ... ])
		.run(callback);
```

