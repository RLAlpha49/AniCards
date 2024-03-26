---
description: Installing application from GitHub
---

# Installation

First, clone the repository:

```bash
git clone https://github.com/RLAlpha49/Anilist-Stat-Cards.git
```

Next, navigate into the cloned repository:

```bash
cd Anilist-Stat-Cards
```

Now, create a Python virtual environment. This will help to keep the dependencies required by different projects separate by creating isolated Python environments for them:

```bash
# If Python and venv are added to your PATH, or you're on macOS or Linux:
python3 -m venv env
# If you're on Windows and Python is not added to your PATH:
py -m venv env
```

Activate the virtual environment:

```bash
# If you're on macOS or Linux:
source env/bin/activate
# If you're on Windows:
.\env\Scripts\activate
```

Then, you can install the necessary Python packages:

```bash
pip install -r requirements.txt
```
