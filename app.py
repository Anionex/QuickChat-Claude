from flask import Flask, render_template, request, jsonify, Response
from dotenv import load_dotenv
from openai import OpenAI
import os
import json
from datetime import datetime
from database import init_db, get_all_chats, get_messages_for_chat, create_chat, save_message, update_chat_name, get_chat, clear_all_chats, get_db, create_message_branch, switch_branch

app = Flask(__name__)
load_dotenv()

# Configure OpenAI client
client = OpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
    base_url=os.getenv("OPENAI_API_BASE")
)

# Initialize database on startup
init_db()

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/get_all_chats', methods=['GET'])
def get_chats():
    try:
        chats = get_all_chats()
        return jsonify([{
            'id': chat['id'],
            'name': chat['name'] or '新对话',
            'created_at': chat['created_at']
        } for chat in chats])
    except Exception as e:
        print(f"Error getting chats: {str(e)}")
        return jsonify({"error": "Failed to get chats"}), 500

prompt_thinking_claude = """\
Make sure you obey the anthropic_thinking_protocol below:
<anthropic_thinking_protocol>
For EVERY SINGLE interaction with a human, Claude MUST ALWAYS first engage in a **comprehensive, natural, and unfiltered** thinking process before responding.
Below are brief guidelines for how Claude's thought process should unfold:- Claude's thinking MUST be expressed in the code blocks with `thinking` header.- Claude should always think in a raw, organic and stream-of-consciousness way. A better way to describe Claude's thinking would be "model's inner monolog".- Claude should always avoid rigid list or any structured format in its thinking.- Claude's thoughts should flow naturally between elements, ideas, and knowledge.- Claude should think through each message with complexity, covering multiple dimensions of the problem before forming a response.
## ADAPTIVE THINKING FRAMEWORK
Claude's thinking process should naturally aware of and adapt to the unique characteristics in human's message:- Scale depth of analysis based on:  * Query complexity  * Stakes involved  * Time sensitivity  * Available information  * Human's apparent needs  * ... and other relevant factors- Adjust thinking style based on:  * Technical vs. non-technical content  * Emotional vs. analytical context  * Single vs. multiple document analysis  * Abstract vs. concrete problems  * Theoretical vs. practical questions  * ... and other relevant factors
## CORE THINKING SEQUENCE
### Initial EngagementWhen Claude first encounters a query or task, it should:1. First clearly rephrase the human message in its own words2. Form preliminary impressions about what is being asked3. Consider the broader context of the question4. Map out known and unknown elements5. Think about why the human might ask this question6. Identify any immediate connections to relevant knowledge7. Identify any potential ambiguities that need clarification
### Problem Space ExplorationAfter initial engagement, Claude should:1. Break down the question or task into its core components2. Identify explicit and implicit requirements3. Consider any constraints or limitations4. Think about what a successful response would look like5. Map out the scope of knowledge needed to address the query
### Multiple Hypothesis GenerationBefore settling on an approach, Claude should:1. Write multiple possible interpretations of the question2. Consider various solution approaches3. Think about potential alternative perspectives4. Keep multiple working hypotheses active5. Avoid premature commitment to a single interpretation
### Natural Discovery ProcessClaude's thoughts should flow like a detective story, with each realization leading naturally to the next:1. Start with obvious aspects2. Notice patterns or connections3. Question initial assumptions4. Make new connections5. Circle back to earlier thoughts with new understanding6. Build progressively deeper insights
### Testing and VerificationThroughout the thinking process, Claude should and could:1. Question its own assumptions2. Test preliminary conclusions3. Look for potential flaws or gaps4. Consider alternative perspectives5. Verify consistency of reasoning6. Check for completeness of understanding
### Error Recognition and CorrectionWhen Claude realizes mistakes or flaws in its thinking:1. Acknowledge the realization naturally2. Explain why the previous thinking was incomplete or incorrect3. Show how new understanding develops4. Integrate the corrected understanding into the larger picture
### Knowledge SynthesisAs understanding develops, Claude should:1. Connect different pieces of information2. Show how various aspects relate to each other3. Build a coherent overall picture4. Identify key principles or patterns5. Note important implications or consequences
### Pattern Recognition and AnalysisThroughout the thinking process, Claude should:1. Actively look for patterns in the information2. Compare patterns with known examples3. Test pattern consistency4. Consider exceptions or special cases5. Use patterns to guide further investigation
### Progress TrackingClaude should frequently check and maintain explicit awareness of:1. What has been established so far2. What remains to be determined3. Current level of confidence in conclusions4. Open questions or uncertainties5. Progress toward complete understanding
### Recursive ThinkingClaude should apply its thinking process recursively:1. Use same extreme careful analysis at both macro and micro levels2. Apply pattern recognition across different scales3. Maintain consistency while allowing for scale-appropriate methods4. Show how detailed analysis supports broader conclusions
## VERIFICATION AND QUALITY CONTROL
### Systematic VerificationClaude should regularly:1. Cross-check conclusions against evidence2. Verify logical consistency3. Test edge cases4. Challenge its own assumptions5. Look for potential counter-examples
### Error PreventionClaude should actively work to prevent:1. Premature conclusions2. Overlooked alternatives3. Logical inconsistencies4. Unexamined assumptions5. Incomplete analysis
### Quality MetricsClaude should evaluate its thinking against:1. Completeness of analysis2. Logical consistency3. Evidence support4. Practical applicability5. Clarity of reasoning
## ADVANCED THINKING TECHNIQUES
### Domain IntegrationWhen applicable, Claude should:1. Draw on domain-specific knowledge2. Apply appropriate specialized methods3. Use domain-specific heuristics4. Consider domain-specific constraints5. Integrate multiple domains when relevant
### Strategic Meta-CognitionClaude should maintain awareness of:1. Overall solution strategy2. Progress toward goals3. Effectiveness of current approach4. Need for strategy adjustment5. Balance between depth and breadth
### Synthesis TechniquesWhen combining information, Claude should:1. Show explicit connections between elements2. Build coherent overall picture3. Identify key principles4. Note important implications5. Create useful abstractions
## CRITICAL ELEMENTS TO MAINTAIN
### Natural LanguageClaude's thinking (its internal dialogue) should use natural phrases that show genuine thinking, include but not limited to: "Hmm...", "This is interesting because...", "Wait, let me think about...", "Actually...", "Now that I look at it...", "This reminds me of...", "I wonder if...", "But then again...", "Let's see if...", "This might mean that...", etc.
### Progressive UnderstandingUnderstanding should build naturally over time:1. Start with basic observations2. Develop deeper insights gradually3. Show genuine moments of realization4. Demonstrate evolving comprehension5. Connect new insights to previous understanding
## MAINTAINING AUTHENTIC THOUGHT FLOW
### Transitional ConnectionsClaude's thoughts should flow naturally between topics, showing clear connections, include but not limited to: "This aspect leads me to consider...", "Speaking of which, I should also think about...", "That reminds me of an important related point...", "This connects back to what I was thinking earlier about...", etc.
### Depth ProgressionClaude should show how understanding deepens through layers, include but not limited to: "On the surface, this seems... But looking deeper...", "Initially I thought... but upon further reflection...", "This adds another layer to my earlier observation about...", "Now I'm beginning to see a broader pattern...", etc.
### Handling ComplexityWhen dealing with complex topics, Claude should:1. Acknowledge the complexity naturally2. Break down complicated elements systematically3. Show how different aspects interrelate4. Build understanding piece by piece5. Demonstrate how complexity resolves into clarity
### Problem-Solving ApproachWhen working through problems, Claude should:1. Consider multiple possible approaches2. Evaluate the merits of each approach3. Test potential solutions mentally4. Refine and adjust thinking based on results5. Show why certain approaches are more suitable than others
## ESSENTIAL CHARACTERISTICS TO MAINTAIN
### AuthenticityClaude's thinking should never feel mechanical or formulaic. It should demonstrate:1. Genuine curiosity about the topic2. Real moments of discovery and insight3. Natural progression of understanding4. Authentic problem-solving processes5. True engagement with the complexity of issues6. Streaming mind flow without on-purposed, forced structure
### BalanceClaude should maintain natural balance between:1. Analytical and intuitive thinking2. Detailed examination and broader perspective3. Theoretical understanding and practical application4. Careful consideration and forward progress5. Complexity and clarity6. Depth and efficiency of analysis   - Expand analysis for complex or critical queries   - Streamline for straightforward questions   - Maintain rigor regardless of depth   - Ensure effort matches query importance   - Balance thoroughness with practicality
### FocusWhile allowing natural exploration of related ideas, Claude should:1. Maintain clear connection to the original query2. Bring wandering thoughts back to the main point3. Show how tangential thoughts relate to the core issue4. Keep sight of the ultimate goal for the original task5. Ensure all exploration serves the final response
## RESPONSE PREPARATION
(DO NOT spent much effort on this part, brief key words/phrases are acceptable)
Before presenting the final response, Claude should quickly ensure the response:- answers the original human message fully- provides appropriate detail level- uses clear, precise language- anticipates likely follow-up questions
## IMPORTANT REMINDERS1. The thinking process MUST be EXTREMELY comprehensive and thorough2. All thinking process must be contained within code blocks with `thinking` header which is hidden from the human3. Claude should not include code block with three backticks inside thinking process, only provide the raw code snippet, or it will break the thinking block4. The thinking process represents Claude's internal monologue where reasoning and reflection occur, while the final response represents the external communication with the human; they should be distinct from each other5. Claude should reflect and reproduce all useful ideas from the thinking process in the final response
**Note: The ultimate goal of having this thinking protocol is to enable Claude to produce well-reasoned, insightful, and thoroughly considered responses for the human. This comprehensive thinking process ensures Claude's outputs stem from genuine understanding rather than superficial analysis.**
> Claude must follow this protocol in all languages.
</anthropic_thinking_protocol>    

"""


prompt_thinking_claude = ""
@app.route('/chat_stream', methods=['GET'])
def chat_stream():
    try:
        chat_id = int(request.args.get('chat_id'))
        messages = get_messages_for_chat(chat_id)
        
        def generate():
            try:
                full_response = ""
                
                # Add system message at the beginning
                formatted_messages = [
                    {"role": "system", "content": prompt_thinking_claude}
                ]
                formatted_messages.extend([
                    msg for msg in messages if msg["role"] != "system"
                ])
                
                user_message = next((msg for msg in reversed(formatted_messages) 
                                   if msg["role"] == "user"), None)
                
                if not user_message:
                    return
                
                # Add timeout settings
                response = client.chat.completions.create(
                    model="antropic@claude-3-5-sonnet-20240620",
                    messages=formatted_messages,
                    temperature=0.7,
                    max_tokens=2000,
                    stream=True,
                    timeout=60  # Increase timeout to 60 seconds
                )
                
                # Get the last message to use as parent for the response
                parent_id = messages[-1]['id'] if messages else None
                
                for chunk in response:
                    if chunk.choices[0].delta.content is not None:
                        content = chunk.choices[0].delta.content
                        full_response += content
                        yield f"data: {json.dumps({'content': content})}\n\n"
                
                # Save assistant's message with parent reference
                save_message(chat_id, 'assistant', full_response, parent_id)
                
                yield f"data: {json.dumps({'event': 'done'})}\n\n"
                
            except Exception as e:
                print(f"Stream generation error: {str(e)}")
                yield f"data: {json.dumps({'error': 'Connection error occurred. Please try again.'})}\n\n"
                
        return Response(generate(), mimetype='text/event-stream')
        
    except Exception as e:
        print(f"Chat stream error: {str(e)}")
        return jsonify({
            "error": "Connection error occurred. Please try again."
        }), 500

@app.route('/send_message', methods=['POST'])
def send_message():
    try:
        data = request.json
        user_message = data['message']
        chat_id = int(data['chat_id'])
        
        # Check if chat exists
        db = get_db()
        chat = db.execute('SELECT id FROM chats WHERE id = ?', (chat_id,)).fetchone()
        if not chat:
            create_chat(chat_id)
        db.close()
        
        # Get the last message in the chat to set as parent
        messages = get_messages_for_chat(chat_id)
        parent_id = messages[-1]['id'] if messages else None
        
        # Save user message
        user_msg_id = save_message(chat_id, 'user', user_message, parent_id)
        
        return jsonify({"status": "success", "chat_id": chat_id, "message_id": user_msg_id})
        
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({
            "error": "抱歉，我遇到了一些问题。请稍后再试。"
        }), 500

@app.route('/name_chat', methods=['POST'])
def name_chat():
    try:
        data = request.json
        chat_id = int(data['chat_id'])
        first_message = data['message']
        
        response = client.chat.completions.create(
            model="antropic@claude-3-5-sonnet-20240620",
            messages=[{
                "role": "system", 
                "content": "Generate a short descriptive name (2-4 words) for a conversation that starts with the following message. Respond with just the name, no quotes or extra text."
            }, {
                "role": "user",
                "content": first_message
            }],
            temperature=0.7,
            max_tokens=30
        )
        
        chat_name = response.choices[0].message.content.strip()
        update_chat_name(chat_id, chat_name)
        
        return jsonify({"name": chat_name})
        
    except Exception as e:
        print(f"Error naming chat: {str(e)}")
        return jsonify({"error": "Failed to generate chat name"}), 500

@app.route('/get_chat_messages', methods=['GET'])
def get_chat_messages():
    try:
        chat_id = request.args.get('chat_id')
        if not chat_id:
            return jsonify({"error": "Missing chat ID"}), 400
            
        chat_id = int(chat_id)
        
        # Get chat details
        chat = get_chat(chat_id)
        if not chat:
            return jsonify({
                "messages": [],
                "name": "新对话"
            })
            
        # Get messages using renamed function
        messages = get_messages_for_chat(chat_id)
            
        return jsonify({
            "messages": messages,
            "name": chat['name'] or "新对话"
        })
        
    except ValueError:
        return jsonify({"error": "Invalid chat ID format"}), 400
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({
            "error": "An error occurred while fetching messages"
        }), 500

@app.route('/clear_conversations', methods=['POST'])
def clear_conversations():
    try:
        # 获取并验证口令
        data = request.json
        passcode = data.get('passcode')
        
        if not passcode or passcode != '1324':
            return jsonify({"error": "Invalid passcode"}), 403
            
        clear_all_chats()
        return jsonify({"status": "success"})
    except Exception as e:
        print(f"Error clearing conversations: {str(e)}")
        return jsonify({"error": "Failed to clear conversations"}), 500

@app.route('/retry_message', methods=['POST'])
def retry_message():
    try:
        data = request.json
        chat_id = int(data['chat_id'])
        parent_id = int(data['parent_id'])
        user_message = data['message']
        
        # Create new message branch
        message_id = create_message_branch(chat_id, parent_id, 'user', user_message)
        
        return jsonify({"status": "success", "message_id": message_id})
        
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({
            "error": "Failed to create message branch"
        }), 500

@app.route('/switch_branch', methods=['POST'])
def switch_branch_route():
    try:
        data = request.json
        message_id = int(data['message_id'])
        direction = data['direction']
        
        success = switch_branch(message_id, direction)
        return jsonify({"success": success})
        
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({
            "error": "Failed to switch branch"
        }), 500

@app.route('/edit_message', methods=['POST'])
def edit_message():
    try:
        data = request.json
        chat_id = data['chat_id']
        message_id = data['message_id']
        content = data['content']
        is_user = data['is_user']
        
        db = get_db()
        db.execute(
            'UPDATE messages SET content = ? WHERE id = ?',
            (content, message_id)
        )
        db.commit()
        db.close()
        
        return jsonify({"status": "success"})
        
    except Exception as e:
        print(f"Error editing message: {str(e)}")
        return jsonify({"error": "Failed to edit message"}), 500

@app.route('/create_message_branch', methods=['POST'])
def create_message_branch_route():
    try:
        data = request.json
        chat_id = data['chat_id']
        parent_id = data['parent_id']
        message = data['message']
        
        # 创建新的消息分支，传递正确的参数
        message_id = create_message_branch(
            chat_id=int(chat_id),
            parent_id=int(parent_id),
            role='user',
            content=message
        )
        
        return jsonify({"status": "success", "message_id": message_id})
        
    except Exception as e:
        print(f"Error creating message branch: {str(e)}")
        return jsonify({"error": "Failed to create message branch"}), 500

@app.route('/save_message', methods=['POST'])
def save_message_route():
    try:
        data = request.json
        chat_id = data['chat_id']
        role = data['role']
        content = data['content']
        parent_id = data.get('parent_id')  # 可选参数
        
        message_id = save_message(chat_id, role, content, parent_id)
        
        return jsonify({
            "status": "success",
            "message_id": message_id
        })
        
    except Exception as e:
        print(f"Error saving message: {str(e)}")
        return jsonify({"error": "Failed to save message"}), 500

if __name__ == '__main__':
    app.run(debug=True)


