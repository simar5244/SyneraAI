from sqlalchemy import Column, Integer, String, Float, ForeignKey, JSON, Boolean, DateTime, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base

class Role(Base):
    """
    Represents a role in the organizational chart.
    Each role can have up to 3 connection slots.
    """
    __tablename__ = "roles"
    
    id = Column(Integer, primary_key=True, index=True)
    layout_id = Column(Integer, ForeignKey("layouts.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text)
    skills_required = Column(JSON, default=list)
    responsibilities = Column(JSON, default=list)
    projects = Column(JSON, default=list)
    workload_hours = Column(Float, default=40.0)
    intensity_factor = Column(Float, default=1.0)
    position_x = Column(Float, default=0)
    position_y = Column(Float, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    layout = relationship("Layout", back_populates="roles")
    outgoing_connections = relationship("Connection", 
                                       foreign_keys="Connection.from_role_id",
                                       back_populates="from_role",
                                       cascade="all, delete-orphan")
    incoming_connections = relationship("Connection", 
                                      foreign_keys="Connection.to_role_id",
                                      back_populates="to_role",
                                      cascade="all, delete-orphan")
    
    def get_total_workload(self):
        """Calculate total workload based on hours and intensity factor"""
        return self.workload_hours * self.intensity_factor
    
    def get_heatmap_status(self):
        """Return the heatmap status based on workload"""
        total_workload = self.get_total_workload()
        if total_workload <= 40:
            return "green"
        elif total_workload <= 55:
            return "yellow"
        elif total_workload <= 70:
            return "red"
        else:
            return "deep_red"

class Connection(Base):
    """
    Represents a connection between two roles (reporting line).
    Each role can have up to 3 connector slots.
    """
    __tablename__ = "connections"
    
    id = Column(Integer, primary_key=True, index=True)
    layout_id = Column(Integer, ForeignKey("layouts.id", ondelete="CASCADE"), nullable=False)
    from_role_id = Column(Integer, ForeignKey("roles.id", ondelete="CASCADE"), nullable=False)
    to_role_id = Column(Integer, ForeignKey("roles.id", ondelete="CASCADE"), nullable=False)
    slot_used = Column(Integer, nullable=False)  # 1, 2, or 3
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    layout = relationship("Layout", back_populates="connections")
    from_role = relationship("Role", foreign_keys=[from_role_id], back_populates="outgoing_connections")
    to_role = relationship("Role", foreign_keys=[to_role_id], back_populates="incoming_connections")

class Layout(Base):
    """
    Represents an organizational chart layout.
    """
    __tablename__ = "layouts"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text)
    created_by = Column(Integer, nullable=False)  # User ID
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    roles = relationship("Role", back_populates="layout", cascade="all, delete-orphan")
    connections = relationship("Connection", back_populates="layout", cascade="all, delete-orphan")

class ActionLog(Base):
    """
    Tracks all actions performed on the canvas for audit and undo/redo.
    """
    __tablename__ = "action_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    layout_id = Column(Integer, ForeignKey("layouts.id", ondelete="CASCADE"), nullable=False)
    action_type = Column(String, nullable=False)  # create_role, delete_role, connect, disconnect, move
    action_data = Column(JSON, nullable=False)    # Store data needed to undo/redo
    performed_by = Column(Integer, nullable=False)  # User ID
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationship
    layout = relationship("Layout")

class SimulationHistory(Base):
    """
    Stores the history of simulations for analysis.
    """
    __tablename__ = "simulation_history"
    
    id = Column(Integer, primary_key=True, index=True)
    layout_id = Column(Integer, ForeignKey("layouts.id", ondelete="CASCADE"), nullable=False)
    simulation_data = Column(JSON, nullable=False)  # Store the entire simulation result
    pros = Column(JSON, default=list)
    cons = Column(JSON, default=list)
    performed_by = Column(Integer, nullable=False)  # User ID
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationship
    layout = relationship("Layout") 