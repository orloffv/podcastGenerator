module.exports = function(grunt) {
    "use strict";
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        folders: {
            build: 'build',
            build_music: 'music'
        },
        site: 'http://podcast.orloffv.ru',
        extensions: ['m4a', 'mp3']
    });

    grunt.registerTask('default', function() {
        var _tasks, tasks, table;

        grunt.log.header('Available tasks');

        _tasks = [];
        Object.keys(grunt.task._tasks).forEach(function(name) {
            var task = grunt.task._tasks[name];
            if (task.meta.info === 'Gruntfile' && !task.multi && name !== 'default') {
                _tasks.push(task);
            }
        });

        tasks = _tasks.map(function(task) {
            var info = task.info;
            if (task.multi) { info += ' *'; }
            return [task.name, info];
        });

        table = function(arr) {
            arr.forEach(function(item) {
                grunt.log.writeln(grunt.log.table([30, 120], [item[0], item[1]]));
            });
        };

        table(tasks);

        grunt.log.writeln();
    });

    grunt.registerTask('podcast:generate', '--fileName=*.xml --dataPath=*', function() {
        var rssFileName = grunt.option('fileName');
        var dataPath = grunt.option('dataPath');
        var done = this.async();

        var rss = require('node-rss');
        var _ = require('underscore');
        var fs = require('fs');
        var mm = require('musicmetadata');

        var globalFiles = [];

        var getExtension = function (fileName) {
            return fileName.split('.').pop();
        };

        var inArray = function(array, item, deep) {
            deep = deep || 0;
            if (typeof array === 'undefined' || array === null) return false;
            var i, l;

            for (i = 0, l = array.length; i < l; i++) {
                if (_.isArray(item) && deep === 0) {
                    if (_.inArray(item, array[i], deep + 1)) {
                        return true;
                    }
                } else if (_.isObject(item)) {
                    if (_.isEqual(array[i], item)) {
                        return true;
                    }
                } else {
                    if (array[i] == item) {
                        return true;
                    }
                }
            }

            return false;
        };

        var getFolderFiles = function(folder) {
            var files = fs.readdirSync(folder);

            for(var i in files) {
                if (!files.hasOwnProperty(i)) continue;
                var fileName = files[i];
                var path = folder + '/'+ fileName;

                if (fs.statSync(path).isDirectory()){
                    getFolderFiles(path);
                } else {
                    if (inArray(grunt.config('extensions'), getExtension(fileName))) {
                        globalFiles.push({fileName: fileName, path: path});
                    }
                }
            }
        };

        var addRssItem = function(path, fileName, callback) {
            var url = grunt.config('site') + '/' + grunt.config('folders.build_music') + '/' + fileName;
            var parser = mm(fs.createReadStream(path), { duration: true });

            grunt.file.copy(path, grunt.config('folders.build_music') + '/' + fileName);

            parser.on('metadata', function (result) {
                grunt.log.writeln('Parsed ' + result.title);

                feed.item({
                    title: result.title,
                    description: result.album + ' ' + result.artist[0],
                    enclosure: {url: url, file:path}
                });

                callback();
            });
        };

        var RSS = require('rss');

        /* lets create an rss feed */
        var feed = new RSS({
            title: 'Music Podcast',
            site_url: grunt.config('site') + '/'
        });

        getFolderFiles(dataPath);
        var countFilesAdded = 0;
        for(var i in globalFiles) {
            if (!globalFiles.hasOwnProperty(i)) continue;

            addRssItem(globalFiles[i]['path'], globalFiles[i]['fileName'], function() {
                countFilesAdded++;
                if (globalFiles.length === countFilesAdded) {
                    var xml = feed.xml();

                    xml = xml.replace(
                        '<rss xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom" version="2.0">',
                        '<rss xmlns:media="http://search.yahoo.com/mrss/" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:geo="http://www.w3.org/2003/01/geo/wgs84_pos#" xmlns:creativeCommons="http://backend.userland.com/creativeCommonsRssModule" version="2.0">'
                    );

                    grunt.file.write(grunt.config('folders.build') + '/' + rssFileName + '.xml', xml);
                    grunt.log.writeln('Rss file created in ' + grunt.config('folders.build') + '/' + rssFileName + '.xml');
                    done();
                }
            });
        }
    });
};
