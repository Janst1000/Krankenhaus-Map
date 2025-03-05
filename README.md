# Krankenhaus Map

## Instructions

### Using Docker Compose
1. Ensure Docker is installed and running.
2. From the project root directory, run:
    ```bash
    docker-compose up
    ```

### Creating a Python Virtual Environment
1. Create a virtual environment:
    ```bash
    python -m venv venv
    ```
2. Activate the virtual environment:
    - **Windows:**
      ```bash
      venv\Scripts\activate
      ```
    - **macOS/Linux:**
      ```bash
      source venv/bin/activate
      ```
3. Install dependencies:
    ```bash
    pip install -r ./backend/requirements.txt
    ```

### Running the Python File
From the project root directory, start the Python application:
```bash
python ./backend/main.py
```
Running the Python file from the root ensures all file paths load correctly.