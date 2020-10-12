import * as minio from "minio";

const minioClient = new minio.Client({
    endPoint: "localhost",
    port: 9000,
    useSSL: false,
    accessKey: "minio",
    secretKey: "miniosecret"
});

// Configure FirebaseUI.
// export const uiConfig = {
//     // Popup signin flow rather than redirect flow.
//     signInFlow: "popup",
//     // Redirect to /signedIn after sign in is successful. Alternatively you can provide a callbacks.signInSuccess function.
//     signInSuccessUrl: null,
//     credentialHelper: firebaseui.auth.CredentialHelper.NONE,
//     // We will display registered email.
//     signInOptions: [firebaseApp.auth.EmailAuthProvider.PROVIDER_ID],
//     callbacks: {
//         signInSuccessWithAuthResult: function(
//             currentUser,
//             credential,
//             redirectUrl
//         ) {
//             return false;
//         }.bind(this),
//         uiShown: null
//     }
// };

export default minioClient;
