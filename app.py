import os
if os.getenv('LANGFUSE_SECRET_KEY'):
    from langfuse.openai import OpenAI
else:
    from openai import OpenAI
import gradio as gr
import dotenv

dotenv.load_dotenv()

client = OpenAI(            
                api_key=os.getenv("OPENAI_API_KEY"),
            base_url=os.getenv("OPENAI_API_BASE"),  
                )

def predict(message, history, system_prompt):
    history_openai_format = [{"role": "system", "content": system_prompt}]
    for human, assistant in history:
        history_openai_format.append({"role": "user", "content": human })
        history_openai_format.append({"role": "assistant", "content":assistant})
    history_openai_format.append({"role": "user", "content": message})
  
    response = client.chat.completions.create(model='llama-3.2-90b-text-preview',
    messages= history_openai_format,
    temperature=1.0,
    stream=True)

    partial_message = ""
    for chunk in response:
        if chunk.choices[0].delta.content is not None:
              partial_message = partial_message + chunk.choices[0].delta.content
              yield partial_message
CSS ="""
.contain { display: flex; flex-direction: column; }
.gradio-container { height: 100vh !important; }
#component-0 { height: 100%; }
#chatbot { flex-grow: 1; overflow: auto;}
"""
with gr.Blocks(css=CSS) as demo:
    system_prompt = gr.Textbox(label="system", placeholder="system prompt here...")
    chatbot = gr.ChatInterface(
        predict,
        additional_inputs=[system_prompt],
    )

demo.launch(server_port=18080)