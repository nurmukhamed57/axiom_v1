#!/bin/bash

curl -X POST 'https://llm-api.k2think.ai/v1/chat/completions' \
-H 'Authorization: Bearer IFM-seW1eggrh5oISPU1' \
-H 'Content-Type: application/json' \
-d '{"model":"MBZUAI-IFM/K2-Think","messages":[{"role":"user","content":"What model are you? Please tell me your exact model name and version."}],"stream":false}'