from sqlmodel import create_engine, Session, SQLModel  # ✅ add SQLModel

DATABASE_URL = "mysql+pymysql://root:amirthag3@localhost:3306/ai_ecom"

engine = create_engine(DATABASE_URL, echo=True)

def get_db():
    with Session(engine) as session:
        yield session

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)   # ✅ now SQLModel is defined
