Users = new Meteor.Collection("users");
Petitions = new Meteor.Collection("petitions");

Router.onBeforeAction(function () {
	if(!Session.get("username") || !Session.get("auth-key")) {
		Session.set("return", Router.current().url);
		Router.go('/signin');
	}
	else {
		this.next();
	}
}, {
	except: ['signin', 'petition.view']
});

Router.route("/signin", function () {
	this.render('SignIn');
});

Router.route("/", function () {
  this.render('SignedPetitions');
}, {
  name: 'petition.signed'
});

Router.route("/petitions/manage", function () {
  this.render('ManagePetitions');
}, {
  name: 'petition.manage'
});

Router.route("/petitions/browse", function () {
  this.render('BrowsePetitions');
}, {
  name: 'petition.browse'
});

Router.route("/petitions/new", function () {
	this.render('AddPetition');
}, {
  name: 'petition.new'
});

Router.route("/petitions/edit/:_id", function () {
	var petition = Petitions.findOne({ _id: this.params._id });
	var username = Session.get("username");

	if(petition && username == petition.author) {
		this.render('EditPetition', { data: petition });
	}
	else {
		var error = { code: 404, message: "Petition Not Found" };
		this.render("Error", { data: error});
	}
}, {
  name: 'petition.edit'
});

Router.route("/petitions/report/:_id", function () {
  var petition = Petitions.findOne({ _id: this.params._id });
	var username = Session.get("username");
	
	if(petition && username == petition.author) {
		this.render('PetitionReport', { data: petition });
	} else {
		var error = { code: 404, message: "Petition Not Found" };
		this.render("Error", { data: error});
	}
}, {
  name: 'petition.report'
});

Router.route("/petitions/:_id", function () {
  var petition = Petitions.findOne({ _id: this.params._id });
	
	if(petition) {
		this.render('ViewPetition', { data: petition });
	} else {
		var error = { code: 404, message: "Petition Not Found" };
		this.render("Error", { data: error});
	}
}, {
  name: 'petition.view'
});

Template.SignIn.helpers({
	failure: function() {
		return Session.get("auth-failure");
	}
});

Template.SignIn.events({
	'keydown #username,#password': function() {
    if(event.keyCode == 13) {
        event.preventDefault();
        $(".submit-signin").click();
    }
	},
	'click .submit-signin': function() {
		var username = document.getElementById("username").value.toLowerCase();
		var password = document.getElementById("password").value;
		
		authenticate(username, password, function() {
			var next = Session.get("return");
			if(!next || next.endsWith("/signin")) {
				Router.go("/");
			} else {
				Session.set("return", null);
				Router.go(next);
			}
		});
	}
});

Template.ManagePetitions.helpers({
	submitted: function() {
		var username = Session.get("username");
		return Petitions.find({ "author": username }, { sort: {'submittedOn':-1}});
	}
});

Template.BrowsePetitions.helpers({
	petitions: function() {
		return Petitions.find({}, { sort: {'submittedOn':-1}});
	}
});

Template.SignedPetitions.helpers({
	signed: function() {
		var username = Session.get("username");
		var user = Users.findOne({ "name": username });

		if (user) {
			return Petitions.find({ _id: { $in: user.signed }}, { sort: {'submittedOn':-1}});
		}
		else return [];
	}
});

Template.AddPetition.events({
	'click #petition-submit': function() {
		var name = document.getElementById("petition-name").value;
		var body = document.getElementById("petition-body").value;
		
		var key = Session.get("auth-key");
		var username = Session.get("username");
		
		Meteor.call("addPetition", key, username, name, body, function(error, petitionId) {
			Router.go("/petitions/"+petitionId);
		});
	}
});

Template.PetitionReport.helpers({
	allSignerEmails: function(petitionId) {
		var petition = Petitions.findOne({ _id: petitionId });

		var emails = [];
		for(var i = 0; i < petition.signers.length; i++) {
			emails.push(petition.signers[i]+"@bowdoin.edu");
		}
		return emails.join(", ");
	}
});
Template.ViewPetition.helpers({
	link: function() {
		return "http://bowdoinpetitions.meteor.com"+Router.current().location.get().pathname;
	},
	isSigned: function(petitionId) {
		var username = Session.get("username");
		var user = Users.findOne({ "name": username });
		return user && user.signed.indexOf(petitionId) > -1;
	},
	isFlagged: function(petitionId) {
		var username = Session.get("username");
		var user = Users.findOne({ "name": username });
		return user && user.flagged.indexOf(petitionId) > -1;
	},
	ownsPetition: function(petitionId) {
		var username = Session.get("username");
		var petition = Petitions.findOne({ _id: petitionId });
		return petition.author == username;
	}
});
Template.ViewPetition.events({
	'click #petition-sign': function() {
		var key = Session.get("auth-key");
		var username = Session.get("username");
		
		if(username && key) { //if signed in, allow signing
			if(confirm("Are you sure you want to support this petition?")) {
				var petitionId = document.getElementById("petition-id").value;

				Meteor.call("signPetition", key, username, petitionId, function(error, result) {
					if (error) {
						alert("Error! Could not sign petition. Please try again later.")
					}
				});
			} 
		} else {
			Session.set("return", Router.current().url);
			Router.go("/signin");
		}
	},
	'click #link': function() {
		document.getElementById("link").select();
	},
	'click #emails': function() {
		document.getElementById("emails").select();
	}
});

Template.EditPetition.events({
	'click #petition-edit': function() {
		var petitionId = document.getElementById("petition-id").value;
		var name = document.getElementById("petition-name").value;
		var body = document.getElementById("petition-body").value;
		
		var key = Session.get("auth-key");
		var username = Session.get("username");
		
		Meteor.call("editPetition", key, username, petitionId, name, body, function(error, result) {
			if(result) {
				Router.go("/petitions/manage");
			} else {
				alert("Sorry, this petition cannot be updated. Please try again later.");
			}
		});
	},
	'click #petition-remove': function() {
		var petitionId = document.getElementById("petition-id").value;
		var key = Session.get("auth-key");
		var username = Session.get("username");
		
		if(confirm("Are you sure you want to delete this petition? This cannot be undone.")) {
			Meteor.call("removePetition", key, username, petitionId, function(error, result) {
				if(result) {
					Router.go("/petitions/manage");
				}
				else {
					alert("Error! Could not delete petition. Please try again later.");
					Router.go("/signin");
				}
			});
		}
	}
});

Template.EditPetition.helpers({
	isSigned: function(signatures) {
		return signatures > 0;
	}
});

Template.Nav.events({
	'click #logout': function() {
		var key = Session.get("auth-key");
		var username = Session.get("username");
		
		Meteor.call("logout", key, username);
		Session.set("username", null);
		Session.set("auth-key", null);
		Router.go("/signin");
	},
	'click a': function() {
		var navMain = $("#bs-example-navbar-collapse-1");
		console.log("TEST");
		navMain.on("click", "a", null, function () {
			 navMain.collapse('hide');
		});
	}
});

Template.Nav.helpers({
	loggedIn: function() {
		return Session.get("username") && Session.get("auth-key");
	},
	username: function() {
		return Session.get("username");
	}
});



authenticate = function(username, password, callback) {
	//auth with username & password
	Meteor.call("authenticate", username, password, function(error, result) {
		if(result) {
			Session.set("auth-failure", false);
			Session.set("auth-key", result);
			Session.set("username", username);
			callback();
		} else {
			Session.set("auth-failure", true);
			Session.set("auth-key", null);
			Session.set("username", null);
			if(!Router.current().url.endsWith("/signin")) {
				Session.set("return", Router.current().url);
				Router.go("/signin");
			}
		}
	});
}

String.prototype.endsWith = function(suffix) {
    return this.indexOf(suffix, this.length - suffix.length) !== -1;
};