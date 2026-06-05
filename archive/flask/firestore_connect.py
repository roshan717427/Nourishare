# functions/utils/firebase.py
import firebase_admin
from firebase_admin import credentials, firestore
import os
import json

def initialize_firebase():
    """Initialize Firebase Admin SDK for Cloud Functions"""
    try:
        # Check if already initialized
        firebase_admin.get_app()
    except ValueError:
        # Initialize if not already done
        if 'GOOGLE_APPLICATION_CREDENTIALS_JSON' in os.environ:
            # Production environment (Vercel)
            cred_dict = json.loads(os.environ['GOOGLE_APPLICATION_CREDENTIALS_JSON'])
            cred = credentials.Certificate(cred_dict)
        else:
            # Local development
            cred = credentials.Certificate('serviceAccountKey.json')
        
        firebase_admin.initialize_app(cred)
    
    return firestore.client()

# Initialize Firestore client
db = initialize_firebase()