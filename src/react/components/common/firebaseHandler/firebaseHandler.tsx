import "firebase/auth";
import "firebase/storage";
import * as firebase from "firebase/app";

var firebaseui = require("firebaseui");

const firebaseApp = firebase;

if (!firebaseApp.apps.length) {
    firebaseApp.initializeApp({
        apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
        authDomain: process.env.REACT_APP_FIREBASE_AUTHDOMAIN,
        databaseURL: process.env.REACT_APP_FIREBASE_DATABASEURL,
        projectId: process.env.REACT_APP_FIREBASE_PROJECTID,
        storageBucket: process.env.REACT_APP_FIREBASE_STORAGEBUCKET,
        messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGINGSENDERID,
        appId: process.env.REACT_APP_FIREBASE_VOTT_FIREBASE_APPID,
        measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENTID
    });
}

// Configure FirebaseUI.
export const uiConfig = {
    // Popup signin flow rather than redirect flow.
    signInFlow: "popup",
    // Redirect to /signedIn after sign in is successful. Alternatively you can provide a callbacks.signInSuccess function.
    signInSuccessUrl: null,
    credentialHelper: firebaseui.auth.CredentialHelper.NONE,
    // We will display registered email.
    signInOptions: [firebaseApp.auth.EmailAuthProvider.PROVIDER_ID],
    callbacks: {
        signInSuccessWithAuthResult: function(
            currentUser,
            credential,
            redirectUrl
        ) {
            return false;
        }.bind(this),
        uiShown: null
    }
};

export default firebaseApp;
