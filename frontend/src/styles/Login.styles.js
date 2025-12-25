export const styles = {
  container: { 
    padding: 30, 
    maxWidth: 400, 
    margin: "100px auto", 
    background: "#1e1e1e", 
    borderRadius: 12, 
    boxShadow: "0 10px 30px rgba(0,0,0,0.5)", 
    position: "relative", 
    zIndex: 9999 
  },
  tabHeader: { display: "flex", justifyContent: "space-between", marginBottom: 10 },
  tab: (isActive) => ({
    flex: 1,
    textAlign: "center",
    padding: "10px",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: "0.9rem",
    transition: "0.3s",
    borderBottom: isActive ? "2px solid #4caf50" : "none",
    color: isActive ? "#4caf50" : "#888"
  }),
  input: { 
    padding: 12, 
    background: "#2a2a2a", 
    color: "white", 
    border: "1px solid #444", 
    borderRadius: 6, 
    outline: "none" 
  },
  button: { 
    padding: 12, 
    background: "#4caf50", 
    color: "white", 
    border: "none", 
    borderRadius: 6, 
    cursor: "pointer", 
    fontWeight: "bold", 
    marginTop: 10 
  },
  backBtn: { 
    background: "none", 
    border: "none", 
    color: "#4caf50", 
    cursor: "pointer", 
    fontSize: "0.9rem", 
    padding: 0 
  },
  message: (type) => ({
    color: type === "error" ? "#ff5252" : "#4caf50",
    fontSize: "0.9rem",
    textAlign: "center"
  }),
  forgotText: {
    textAlign: "center",
    color: "#888",
    fontSize: "0.85rem",
    cursor: "pointer",
    marginTop: 5
  }
};