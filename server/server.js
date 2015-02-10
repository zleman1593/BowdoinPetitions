Users = new Meteor.Collection("users");					//user db
Keys  = new Meteor.Collection("keys");
Petitions = new Meteor.Collection("petitions");	//petition db

Meteor.methods({
	//authenticate with Bowdoin server; returns 0 is incorrect, random string otherwise
	authenticate: function(username, password) {
		var result = HTTP.post("https://www.bowdoin.edu/apps/mobile/login.php", { params: { username: username, password: password } });
		if(result && result.content != "0") {
			var crypto = Npm.require("crypto");
			var key = crypto.randomBytes(20).toString('hex');

			//set key on user; create user if they don't exist
			var user = Users.findOne({ "name": username });
			if(!user) {
				Users.insert({
					"name" : username,
					"signed" : [],
					"flagged" : [],
				});
			}
			
			Keys.insert({
				"user" : username,
				"key" : key,
				"createdAt": new Date()
			});
			
			return key;
		} else {
			return false;
	 	}
	},
	
	authWithKey: function(key, username) {
		var key = Keys.findOne({ "key": key });
		return key && key.user == username;
	},
	
	logout: function(key, username) {
		if(Meteor.call("authWithKey", key, username)) {
			var user = Users.findOne({ "name": username });
			Users.update({ _id: user._id }, { 
				$set: { 
					"key": null
				}
			});
		}
	},
	
	//adds new petition, creates user if they don't exit
	addPetition: function(key, username, name, body) {
		if(Meteor.call("authWithKey", key, username)) {
			return Petitions.insert({
				"name" : name,
				"body" : body,
				"author" : username,
				"signatures" : 0,
				"signers" : [],
				"flags" : 0, 
				"submittedOn" : new Date()
			});
		} else {
			return 0;
		}
	},
	
	//if not signed: allows modification of body/title of petition
	editPetition: function(key, username, petitionId, name, body) {
		if(Meteor.call("authWithKey", key, username)) {
			var petition = Petitions.findOne({ _id: petitionId});

			if(petition && petition.signatures == 0 && petition.author == username) {
				return Petitions.update({ _id: petitionId }, { 
					$set: { 
						"name": name, 
						"body": body 
					}
				});
			} else return false;
		} else return false;
	},
	
	//removes petition entirely
	removePetition: function(key, username, petitionId) {
		if(Meteor.call("authWithKey", key, username)) {
			var petition = Petitions.findOne({ _id: petitionId});
			if(petition.author == username) {
				return Petitions.remove({ _id: petitionId });
			} else return false;
		} else return false;
	},
	
	//if unflagged by user: adds to user flag history, increments flag count on petition
	flagPetition: function(key, username, petitionId) {
		if(Meteor.call("authWithKey", key, username)) {
			var user = Users.findOne({ "name": username });
			if(user && user.flagged.indexOf(petitionId) === -1) {
				Users.update({ _id: user._id }, { 
					$push: { 
						"flagged": petitionId 
					}
				});

				Petitions.update({ _id: petitionId }, { $inc: { "flags": 1}});
			}
			else if(!user) {
				Users.insert({
					"name" : username,
					"signed" : [],
					"flagged" : [petitionId]
				});

				Petitions.update(petitionId, { $inc : { "flags": 1}});
			}
		} else return false;
	},
	
	//if unsigned by user: adds to user petition history, increments signature count on petition
	signPetition: function(key, username, petitionId) {
		if(Meteor.call("authWithKey", key, username)) {
			var user = Users.findOne({ "name": username });
			if(user.signed.indexOf(petitionId) === -1) {
				Users.update({ _id: user._id }, { 
					$push: { 
						"signed": petitionId 
					}
				});

				Petitions.update({ _id: petitionId }, { 
					$inc: { 
						"signatures": 1
					}, 
					$push: { 
						"signers": user.name
					}
				});
			}
		}
	},
	//if signed by user: removes from user petition history, decrements signature count on petition
	unsignPetition: function(key, username, petitionId) {
		if(Meteor.call("authWithKey", key, username)) {
			var user = Users.findOne({ "name": username });
			if(user.signed.indexOf(petitionId) != -1) {
				Users.update({ _id: user._id }, { 
					$pull: { 
						"signed": petitionId 
					}
				});

				Petitions.update({ _id: petitionId }, { 
					$inc: { 
						"signatures": -1
					}, 
					$pull: { 
						"signers": user.name
					}
				});
			}
		}
	}
});