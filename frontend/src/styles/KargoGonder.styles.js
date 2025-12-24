// KargoGonder.styles.js
export const styles = {
  container: {
    maxWidth: "600px",
    margin: "40px auto",
    padding: "32px",
    background: "linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)",
    borderRadius: "16px",
    border: "1px solid #333",
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)"
  },

  header: {
    marginBottom: "24px"
  },

  title: {
    color: "#2196F3",
    fontSize: "28px",
    fontWeight: "700",
    margin: "0 0 12px 0",
    display: "flex",
    alignItems: "center",
    gap: "12px"
  },

  subtitle: {
    color: "#aaa",
    fontSize: "14px",
    margin: 0,
    lineHeight: "1.6"
  },

  destinationBadge: {
    display: "inline-block",
    background: "#1a2a3a",
    color: "#64b5f6",
    padding: "6px 12px",
    borderRadius: "8px",
    fontWeight: "600",
    border: "1px solid #2a3f5f",
    marginLeft: "8px"
  },

  form: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
    marginTop: "24px"
  },

  inputGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "8px"
  },

  label: {
    color: "#ccc",
    fontSize: "14px",
    fontWeight: "600",
    letterSpacing: "0.3px"
  },

  input: {
    padding: "14px 16px",
    borderRadius: "10px",
    border: "1px solid #444",
    background: "#0f0f0f",
    color: "white",
    fontSize: "14px",
    outline: "none",
    transition: "all 0.3s",
    fontFamily: "inherit"
  },

  inputFocus: {
    border: "1px solid #2196F3",
    boxShadow: "0 0 0 3px rgba(33, 150, 243, 0.1)"
  },

  select: {
    padding: "14px 16px",
    borderRadius: "10px",
    border: "1px solid #444",
    background: "#0f0f0f",
    color: "white",
    fontSize: "14px",
    outline: "none",
    cursor: "pointer",
    transition: "all 0.3s",
    fontFamily: "inherit"
  },

  flexRow: {
    display: "flex",
    gap: "16px"
  },

  flexItem: {
    flex: 1
  },

  button: {
    padding: "16px 24px",
    background: "linear-gradient(135deg, #2196F3 0%, #1976D2 100%)",
    color: "white",
    border: "none",
    borderRadius: "12px",
    fontWeight: "700",
    fontSize: "15px",
    cursor: "pointer",
    transition: "all 0.3s",
    boxShadow: "0 4px 15px rgba(33, 150, 243, 0.3)",
    marginTop: "8px"
  },

  buttonHover: {
    transform: "translateY(-2px)",
    boxShadow: "0 6px 20px rgba(33, 150, 243, 0.4)"
  },

  buttonDisabled: {
    opacity: 0.6,
    cursor: "not-allowed"
  },

  statusMessage: {
    marginTop: "16px",
    padding: "16px",
    textAlign: "center",
    borderRadius: "10px",
    fontWeight: "600",
    fontSize: "14px",
    animation: "fadeIn 0.3s ease-in"
  },

  statusSuccess: {
    background: "rgba(76, 175, 80, 0.15)",
    color: "#4caf50",
    border: "1px solid rgba(76, 175, 80, 0.3)"
  },

  statusError: {
    background: "rgba(244, 67, 54, 0.15)",
    color: "#f44336",
    border: "1px solid rgba(244, 67, 54, 0.3)"
  },

  statusLoading: {
    background: "rgba(255, 152, 0, 0.15)",
    color: "#ff9800",
    border: "1px solid rgba(255, 152, 0, 0.3)"
  },

  infoBox: {
    background: "rgba(33, 150, 243, 0.1)",
    border: "1px solid rgba(33, 150, 243, 0.3)",
    borderRadius: "10px",
    padding: "16px",
    marginBottom: "20px"
  },

  infoTitle: {
    color: "#2196F3",
    fontSize: "13px",
    fontWeight: "600",
    marginBottom: "8px",
    display: "flex",
    alignItems: "center",
    gap: "8px"
  },

  infoText: {
    color: "#aaa",
    fontSize: "13px",
    lineHeight: "1.6",
    margin: 0
  },

  formCard: {
    background: "#1a1a1a",
    borderRadius: "12px",
    padding: "24px",
    border: "1px solid #2a2a2a"
  },

  divider: {
    height: "1px",
    background: "#2a2a2a",
    margin: "24px 0",
    border: "none"
  },

  helperText: {
    fontSize: "12px",
    color: "#666",
    marginTop: "4px",
    fontStyle: "italic"
  },

  requiredStar: {
    color: "#f44336",
    marginLeft: "4px"
  }
};