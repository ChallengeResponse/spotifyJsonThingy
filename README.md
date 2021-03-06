# BuildBook Coding Exercise

## Greetings
Hi there!
I hope the parts of this which do not meet your standards or expectations can be identified and discussed, although I really hope there aren't many of those. I did send a couple of questions over, with some assumed answers, and I actually went a little past one of the assumed answers so I'll detail that in a bit.

First I wanted to address if this is a good example for showing my best work. I did take some time on it, not all of it heads down focusing time but about 2 hours to do the more task-specific code and some time later to finish up file and command line argument handling. I also lost a little time to debugging a confusing issue, but I don't really count (a deployment process would have rejected the build).

The end result seems well suited to serve my goal, which was to provide as simple of a main file as possible in terms of being easy for someone to run while also providing some code I felt could solve the assignment and be ready for more. There are assumed or known issues, though, which I tried to record or nullify in the acceptance criteria and other sections below.

## Tools
Regarding tools I used, I want to introduce this with the statement that I'd expect a production situation to include a build process, linting, testing, and some kind of scripted, automated, or semi-automated deployment. I have no problem setting up some CI scripts or other things like that, but for something as simple as this project there's a million tutorials or skeleton directories that does it all and the assignment mentions not to make a deployment. I agree with the assignment here -- premade systems don't show much about what I know or how I code. What you're getting is not going to be bloated up with any of that stuff. The index.js file should run in node (my version is 10.19) with no other interpreters, babel/transpiling, npm/yarn, or node modules. This is something I can write, and indeed did write, purely on the command line with vim and node. If spelling must be part of my marks let me know and I'll pull things down to something besides command line do a check.

Overall I think this approach should give you the best idea of what I would be thinking when coding, even if other tools might help with autofilling variable names or catching when you end up with a single equals between variables in the test block of an if statement.

## Some Known Issues or Notes
* Generally I assumed a well formed/comliant JSON (for instance I don't verify that song_ids is there when I expect it), but I'm sure you'll see its easy to add some things to index.js which would address this issue
* As an extension to that, I also treated ids as strings to be consistant with the example json, but if it changed (like provided as integers in the input file) parts of the code may break. I could always switch it back and forth, but how many examples of .map do you really want to read?
* I treated output file format with regards to certain whitespace (as in "id": "2" vs "id" : "2") as irrelevant (it is done both ways in spotify.json)
* The order of playlists is likely to change (meaning spotify.json might have playlist 1 appear before playlist 2 but the output may swap those, but the order of songs on a playlist should be maintained)

# Acceptance Criteria and Change JSON Format
There wasn't really a scenario that came along with the requirements, but with the example data and requirements I pictured something like reconstructing a database from web logs or transaction logs of some sort that were gathered between when there was a known state and now. Assuming those logs may be distributed among different servers but should have accurate timestamps, I also supported the change file being out of order. 

To demonstrate a thing or two, I did set things up to reject a change submitted by user 2 for a playlist owned by user 1. Of course, it doesn't actually have a user table and authentication information, so to make sense the idea I went with is that the logs or system providing the changes is trusted to know and accurately report who requested each change, but does not know whether the change was permitted.

With that in mind:
## Senario 1
A user with an id of 1 added a single song to the 4th position of an existing playlist with an id of 4
### Example Change Object
`
          {
                  "time":1649285466008,
                  "user": "1",
                  "method":"PATCH",
                  "playlist_id": "4",
                  "position": 3,
                  "song_ids": "20" 
          }
`

The optional position argument is the location to start the insert in an array (starting at 0), and if omitted the song(s) will be appended to the playlist. If multiple songs were inserted at once an array of song ids is accepted.
### Expected Result
The playlist song ids would go from something like [ 1, 2, 3, 4, 5 ] to [ 1, 2, 3, 4, 20, 5] if it is owned by user 1, otherwise no playlists are changed.

## Senario 2
A user with an id of 1 created a new playlist with 4 songs.
### Example Change Object
`
          {
                  "time":1649285466008,
                  "user": "1",
                  "method":"POST",
                  "song_ids": [ "1", "2", "3", "4" ] 
          }
`
### Expected Result
A new playlist with a unique id, the provided songs, and an association with the users account) will be created.

## Senario 3
A user with an id of 2 issued a delete for a playlist with the id of 1
### Example Change Object
`
	  {
		  "time":1649285466005,
		  "user": "2",
		  "method":"DELETE",
		  "playlist_id": "1"
          }
`

### Expected Result
If it is associated with user 2, the playlist with id 1 would be deleted and future attempts to modify that playlist would do nothing.

## Other change format details
The change file can be any json file with a "changes" array as a top level item, and entries like those in the above examples would fill the array.  An example of a changes file can be seen in tests/allinone.json which is spotify.json and an added changes array.

# Testing/Running
NOTE: Just in case someone mistakenly enters an existing output file it will refuse to run so that it avoids overwriting something, no flag exists to accept the overwrite

Tested/created with node 10.19 on the latest ubuntu lts

There are no automated/unit tests that would be part of a deployment, but one can still verify that given the example file "allinone.json" a certain output is expected. 

Running can be as simple as:
`node index.js tests/allinone.json tests/allinone.json output.json`

If one requires the example method of running, that does not list both interpreter and code file before the input file, run.sh should provide that option and work on most platforms though it has not been tested on mac (an of corse changes could be in their own file).
`./run.sh spotify.json changes.json output.json`

The provided change example in tests/allinone.json include
* out of order changes which may reveal that they were not sorted by timestamp if song 20 is inserted at the wrong place
* an unsupported method which will give a console error output
* edits from one user trying to impact another user's playlist
* repeated deletes of the same playlist

### Expected console and file output using tests/allinone.json 
Due to the intentional erroneous changes you should get a console error about a PUT change and two warnings about missing playlists when you run with allinone.json

`
	Cannot process requested change { time: 1649285466003,
	  user: '3',
	  method: 'PUT',
	  playlist_id: '2',
	  song_ids: [ '14', '6', '8', '11' ] }
	No support for requested method: PUT
	-------
	Playlist id 1 not found under user id 3
	Playlist id 1 not found under user id 2
`

In that example, the resulting output.json I get is in the tests folder for comparison.  Alternatively, you could check the sha256 as it has an sha256sum of a06121d38877e71a320f149c1550468ced24373778485161ae9ebb220da3330a without a newline at the end of the file or 4b97cb509fa4baa61037768528b4e17ef214f3170d3c9899028aa12c7e81ed32 with one. If you can't verify you're getting the same result as me with the file or either checksum here, it differs by the input/change file by not having the changes array, not having playlist 1, having playlist 4 with song 20 somewhere in the middle, and playlist id 2 got songs 12 and 13 added to the front.

# Scaling Up
This solution would likely handle source/output files up to 3mb relatively well. Depending on data distribution it could by stretched by splitting songs, playlists, and users into their own files and outputting only the replacement playlists. Another way to buy a little time in a growing dataset would be to filter the data that goes into the files before passing them in (user names and song names stand out as unused yet "large" strings by percentage of total data). However, javascript's string size limitation would ultimately be hit and the entire file could no longer be tossed into a string for passing to the JSON parser.

Instead of reading the entire JSON, one could read through while tracking unescaped delimiters like } ] and " to JSON parse pieces of the file(s) at a time.  One could do this by providing the necessary closing points at safe places or stopping when they were reached. This would largely move the limitation to system or process memory availability. Some things during parsing could assist there, as well, such as using the structure in place of how json parsed it though finding/filtering would then regularly have to work against entire datasets unless something was done to assist in those regards. Also, handling changes in batches would potentially help if the change file is a major part of the memory usage (but in the given scenario timestamps would have to be lined up for every batch).

Once memory becomes an issue it would need a different storage system, typically a relational database and usually implemented long before ram becomes an issue, but of course other options exist. If "records" are not so tiny that drive block sizes come heavily into play, or if using certain systems to skirt around that, a filesystem folder structure can technically serve as an organized way to offload memory to disk as is the case with certain technologies. Storage systems of all kinds typically support multiple connections as well, meaning the right arrangement and planning in the code would allow parallel processing of changes and a horizontal growth of the system becomes possible (the ram and computational load could be distributed across many servers).
