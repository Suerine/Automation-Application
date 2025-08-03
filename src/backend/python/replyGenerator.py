import sys
import json
import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv() 

# Configure AI client
client = OpenAI(
    api_key= os.getenv("OPENROUTER_API_KEY"),
    base_url="https://openrouter.ai/api/v1",
    timeout=20  # 20 second timeout
)

def generate_replies(email_data):
    """Generate email reply suggestions using AI"""
    try:
        response = client.chat.completions.create(
            model="openai/gpt-3.5-turbo",
            messages=[
                {
                    "role": "system",
                    "content": "You are an assistant that helps reply to emails professionally. Generate concise, appropriate responses even when the email content is unclear. Always have a response relevant to the email."
                },
                {
                    "role": "user",
                    "content": f"""Generate 3 concise email reply options as a JSON array.
                    Email Subject: {email_data.get('subject', 'No subject')}
                    From: {email_data.get('sender', 'Unknown sender')}
                    Content: {email_data.get('body', '')}"""
                }
            ],
            response_format={"type": "json_object"},
            temperature=0.7,
        )
        
        content = response.choices[0].message.content
        result = json.loads(content)
        return result.get("replies", ["No suggestions generated"])
    
    except Exception as e:
        return {"error": f"AI service error: {str(e)}"}

if __name__ == '__main__':
    try:
        # Read input from stdin
        input_json = sys.stdin.read()
        email_data = json.loads(input_json)
        
        # Generate and return replies
        replies = generate_replies(email_data)
        print(json.dumps({"replies": replies}))
        
    except json.JSONDecodeError:
        print(json.dumps({"error": "Invalid JSON input"}))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"error": f"Processing error: {str(e)}"}))
