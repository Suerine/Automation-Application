import os.path, re, sys, base64, json
from email.mime.text import MIMEText
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from bs4 import BeautifulSoup

# If modifying these scopes, delete the token.json file
SCOPES = [
    'https://www.googleapis.com/auth/gmail.modify',  # For reading inbox
    'https://www.googleapis.com/auth/gmail.send'       # For sending email
]

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

CREDENTIALS_PATH = os.path.join(BASE_DIR, 'credentials.json')
TOKEN_PATH = os.path.join(BASE_DIR, 'token.json')

def authenticate():
    """Authenticate the user and return a Gmail service instance."""
    creds = None

    # Load existing token if available
    if os.path.exists(TOKEN_PATH):
        creds = Credentials.from_authorized_user_file(TOKEN_PATH, SCOPES)

    # If no valid credentials, do OAuth
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_PATH, SCOPES)
            creds = flow.run_local_server(port=0)
        # Save the token for next time
        with open(TOKEN_PATH, 'w') as token:
            token.write(creds.to_json())

    return build('gmail', 'v1', credentials=creds)


def send_email(service, to, subject, body):
    """Send an email using the Gmail API."""
    message = MIMEText(body)
    message['to'] = to
    message['subject'] = subject

    raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode()
    body = {'raw': raw_message}

    sent_message = service.users().messages().send(userId="me", body=body).execute()
    print(f'✅ Email sent! Message ID: {sent_message["id"]}')

def list_messages(service, max_results=10):
    """List the latest messages from the inbox, including body."""
    results = service.users().messages().list(userId='me', labelIds=['INBOX'], maxResults=max_results).execute()
    messages = results.get('messages', [])

    if not messages:
        return { "header": "📭 No messages found.", "emails": [] }

    email_list = []
    for msg in messages:
        msg_detail = service.users().messages().get(userId='me', id=msg['id'], format='full').execute()
        headers = msg_detail['payload'].get('headers', [])
        subject = sender = ''

        for header in headers:
            if header['name'] == 'Subject':
                subject = header['value']
            elif header['name'] == 'From':
                sender = header['value']

        body = get_body(msg_detail['payload'])

        email_list.append({
            "from": sender,
            "subject": subject,
            "body": body
        })

    return {
        "header": f"Latest {len(messages)} message(s):",
        "emails": email_list
    }


def get_body(msg_payload):
    def normalize_whitespace(text):
        """Normalize all types of whitespace including line breaks."""
        text = re.sub(r'\r\n|\r|\n', '\n', text)
        text = re.sub(r'\n{3,}', '\n\n', text)
        text = re.sub(r'^[ \t]+|[ \t]+$', '', text, flags=re.MULTILINE)
        text = re.sub(r'[ \t]+', ' ', text)
        return text.strip()

    def extract_text_from_html(html):
        """Extract and clean text from HTML email."""
        soup = BeautifulSoup(html, 'html.parser')
        for element in soup(['head', 'style', 'script', 'meta', 'link']):
            element.decompose()
        text = soup.get_text('\n')
        return normalize_whitespace(text)

    parts = msg_payload.get('parts', [])
    if parts:
        for part in parts:
            mime_type = part.get('mimeType')
            data = part.get('body', {}).get('data')
            if not data:
                continue
            decoded = base64.urlsafe_b64decode(data).decode('utf-8')
            if mime_type == 'text/html':
                return extract_text_from_html(decoded)
            elif mime_type == 'text/plain':
                return normalize_whitespace(decoded)
    else:
        # Handle non-MIME message bodies
        body_data = msg_payload.get('body', {}).get('data')
        if body_data:
            decoded = base64.urlsafe_b64decode(body_data).decode('utf-8')
            return normalize_whitespace(decoded)

    return ""


def run_cli():
  if len(sys.argv) > 1:
      mode = sys.argv[1]

      if mode == 'list':
          service = authenticate()
          data = list_messages(service)
          print(json.dumps(data, indent=None))
      elif mode == 'send' and len(sys.argv) >= 5:
          to = sys.argv[2]
          subject = sys.argv[3]
          body = sys.argv[4]
          send_email(authenticate(), to, subject, body)
      else:
          print("❌ Invalid arguments.")
  else:
      print("⚠️ No command provided.")

if __name__ == '__main__':
    run_cli()  