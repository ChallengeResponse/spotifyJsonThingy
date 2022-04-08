const fs = require('fs');

const commandArguments=2;
let files = ["input","changes", "output"];

//console.log(process.argv);

if (process.argv.length !== files.length + commandArguments){
	console.error("Usage check failure: please include 2 input files and one output file as arguments e.g. spotify.json changes.json output-file.json");
	process.exit(1);
}

files = files.map( (name,i) => {
	const loc=process.argv[commandArguments+i];
	let contents;
	try {
		const reader = fs.readFileSync(loc);
		if (i===files.length-1){
			// there's already an output file at the given location or else the catch would be running
			console.error("output file " + loc + " appears to exit already: cowardly refusing to do anything");
			process.exit(1);
		}
		contents = JSON.parse(reader.toString());
	} catch (e) {
		// output file will hopefully not exist, so to do nothing if this catch
		// is running for output file(last arg), look for i being < length -1
		if (i<files.length-1){
			console.error("Error with required " + name + " file. Is it small (<4mb) enough for a javascript string, does it contain valid JSON, and does it exist at " + loc  + "?");
			console.error(e.toString());
			process.exit(1);
		}
	}
	return { name: name, loc: loc, contents: contents };
});

const changeHandler = (spotifyState) => {
	// a place to store changes that pass preflight checks
	let changeList = [];

	// a wrapper for change handlers to centralize their logging/tests regarding songs that exist
	// also ensures song_ids is an array by taking a non-array value and putting it in an array of 1
	// onLegit function will recieve filtered/legit song array as its only argument
	const wrap_requireLegitSongs=(change,onLegit) => {
		const startArray = (Array.isArray(change.song_ids)) ? change.song_ids : [ change.song_ids ];
		const legitSongs = startArray.filter( song_id => spotifyState.songs.some( song => song.id === song_id ) );
		if (legitSongs.length > 0){
			if (legitSongs.length < startArray.length){
				console.warn("Songs which did not exists were in song list for change:",change,"Using song list:",legitSongs);
			}
			onLegit(legitSongs);
		} else {
			console.error("Due to no legitimate song ids, the following change cannot be processed:", change);
		}
	};

	// a wrapper for change handlers to centralize their logging/tests regarding playlists that exist
	// onExists function will recieve the index of the correct playlist from the user's playlists array as its only argument
	const wrap_requirePlaylistExists=(change,onExists) => {
		const pl_i = spotifyState.usersAndLists[change.target].playlists.findIndex( pl => pl.id === change.playlist_id );
		if (pl_i > -1){
			onExists(pl_i);
		} else {
			console.warn("Playlist id " + change.playlist_id + " not found under user id " + spotifyState.usersAndLists[change.target].id);
		}
	};

	const supportedMethods = {
		// for creating a playlist
		POST:(change) =>
			wrap_requireLegitSongs(change, (legitSongs) =>{
				// at this point a user exists (change.target for index),
				// and an array of legitimate song(s) exists
				//
				// we have to assume the create change has the correct/authorized user id
				//
				// new playlist will need new id
				spotifyState.highestPlaylistId += 1;
				// create playlist 
				spotifyState.usersAndLists[change.target].playlists.push({
					id: spotifyState.highestPlaylistId.toString(),
					owner_id: spotifyState.usersAndLists[change.target].id,
					song_ids: legitSongs
				});
		}),
		// for adding to a playlist
		PATCH:(change) =>
			wrap_requirePlaylistExists(change, (pl_i) => {
				wrap_requireLegitSongs(change, (legitSongs) =>{
					// at this point a user exists (change.target for index),
					// a playlist under that user exists (pl_i for index),
					// and an array of legitimate song(s) exists
					//
					// Position unset or invalid? append. Otherwise use position
					// NOTE: splice with a number greater than array length will append,
					//   so using length or anything greater will be fine. Negative
					//   numbers will count up from the back of the array.
					const usePos = (Number.isInteger(change.position)) ? change.position
						: spotifyState.usersAndLists[change.target].playlists[pl_i].length;
	
					// insert to array
					spotifyState.usersAndLists[change.target].playlists[pl_i].song_ids.splice(usePos,0,...legitSongs);
	
					// a prepend/append only could maybe set strings "push" or "unshift" to addFunc then playlists[pl_i][addFunc](...legitSongs)
					// or build a new array via expansion like [...legitSongs, ...originalArray] but splice does any position and works in place
				})
		}),
		// for deleting a playlist
		DELETE:(change) =>{
			wrap_requirePlaylistExists(change, (pl_i) => {
				// playlist exists and is at index pl_i of the user's playlist array, splice it out
				spotifyState.usersAndLists[change.target].playlists.splice(pl_i,1);
			})
		}
	};

	return {
		// a function to do some state-dependant checks and add the user array index to change.target
		addChange: (change) => {
			const errors = [];
			// all changes are related to user accounts
			const target = spotifyState.usersAndLists.findIndex(u => u.id === change.user);
			if (target < 0){
				errors.push( "Cannot add change for user which does not exist. User id: " + change.user );
			}
			// only some changes/methods are possible
			if (typeof(supportedMethods[change.method]) !== "function"){
				errors.push( "No support for requested method: "  + change.method );
			}
			if (errors.length > 0){
				console.error("Cannot process requested change",change);
				errors.forEach(e => console.error(e));
				console.error("-------");
			} else {
				// Errors that aren't method-specific have been handled, remaining errors will be up to the change handlers
				change.target = target;
				changeList.push(change);
			}
		},
		// a function to apply every successfully-added change
		applyChanges: () => {
			changeList.forEach(change => {
				supportedMethods[change.method](change);
			});
			// prevent repeating the same changes
			changeList = [];
		}
	};
}

const playlistExporter = (spotifyState) => ({
	exportPlaylists: () => spotifyState.usersAndLists.reduce((all, curr)=>[...all,...curr.playlists],[])
});

const spotifySystem = (sources) => {
	let state = {
		// mapping owned items to their owners helps enforce privileges/maintain privacy
		usersAndLists: sources.users.map(user => {
			return Object.assign({},user,{playlists:sources.playlists.filter( list => list.owner_id === user.id )});
		}),
		// bring the available songs into the state
		songs: sources.songs,
		// playlists can be added but presumably they require a globally unique id
		// 	and I assumed that would not be in the changes file
		// 	but that also potentially creates an issue if a user altered a playlist in
		// 	the same set of changes as where it was created, so a uniqueness enforcer
		// 	is required. It is treated as if the next id available for a playlist
		// 	will be one above the current max e.g. if state was taken just after the
		// 	max was deleted there will be a disconnect, but if not and if changes are timestamped
		// 	then presumably this would replicate a database autoincrement id field well
		highestPlaylistId:sources.playlists.reduce( (max,curr) =>{ return ( max > parseInt(curr.id,10)) ? max : parseInt(curr.id,10) }, 0 ),
	};

	return Object.assign(
		{},
		changeHandler(state),
		playlistExporter(state)
	);
}

const spotifyUserData = spotifySystem(files[0].contents);

files[1].contents.changes
	// ensure changes are sequential, like the user presumably experienced, otherwise issues are more likely 
	.sort((a,b)=>a.time-b.time)
	// do the preflight checks and queue up each change
	.forEach(change => spotifyUserData.addChange(change));

// apply the queued up changes
spotifyUserData.applyChanges();

try {
	fs.writeFileSync(files[2].loc,JSON.stringify(
		{
			users:files[0].contents.users,
			playlists:spotifyUserData.exportPlaylists(),
			songs:files[0].contents.songs
		},
	null,2));
	process.exit(0); // success
} catch (e) {
	console.error("Error writing output file! Do you have write permissions, or is the JSON parser failing because it exceeds max string size?",e.toString());
	process.exit(1); // failure -- so close though!
}
