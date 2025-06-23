from sqlalchemy import Column, Integer, String, Float, ForeignKey, JSON, DateTime, Boolean, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()


class OrganizationLayout(Base):
    """Represents a complete organization structure layout"""
    __tablename__ = "organization_layouts"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())
    is_active = Column(Boolean, default=True)
    
    # Relationships
    nodes = relationship("LayoutNode", back_populates="layout", cascade="all, delete-orphan")
    connections = relationship("NodeConnection", back_populates="layout", cascade="all, delete-orphan")
    simulations = relationship("SimulationHistory", back_populates="layout", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"OrganizationLayout(id={self.id}, name={self.name})"


class LayoutNode(Base):
    """Represents a node in an organization layout (e.g., person, role, department)"""
    __tablename__ = "layout_nodes"
    
    id = Column(Integer, primary_key=True, index=True)
    layout_id = Column(Integer, ForeignKey("organization_layouts.id", ondelete="CASCADE"), nullable=False)
    node_type = Column(String(50), nullable=False)  # e.g., "person", "role", "department"
    position_x = Column(Float, default=0)
    position_y = Column(Float, default=0)
    node_metadata = Column(JSON, nullable=True)  # Store flexible metadata like name, role, etc.
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    layout = relationship("OrganizationLayout", back_populates="nodes")
    outgoing_connections = relationship(
        "NodeConnection", 
        foreign_keys="NodeConnection.source_id", 
        back_populates="source_node",
        cascade="all, delete-orphan"
    )
    incoming_connections = relationship(
        "NodeConnection", 
        foreign_keys="NodeConnection.target_id", 
        back_populates="target_node",
        cascade="all, delete-orphan"
    )
    
    def __repr__(self):
        return f"LayoutNode(id={self.id}, type={self.node_type}, layout_id={self.layout_id})"


class NodeConnection(Base):
    """Represents a connection between two nodes (e.g., reporting relationship)"""
    __tablename__ = "node_connections"
    
    id = Column(Integer, primary_key=True, index=True)
    layout_id = Column(Integer, ForeignKey("organization_layouts.id", ondelete="CASCADE"), nullable=False)
    source_id = Column(Integer, ForeignKey("layout_nodes.id", ondelete="CASCADE"), nullable=False)
    target_id = Column(Integer, ForeignKey("layout_nodes.id", ondelete="CASCADE"), nullable=False)
    connection_type = Column(String(50), nullable=False)  # e.g., "reports_to", "collaborates_with"
    connection_metadata = Column(JSON, nullable=True)  # For storing attributes like strength, type details
    workload_impact = Column(Float, default=10.0)  # Impact on workload calculation
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    layout = relationship("OrganizationLayout", back_populates="connections")
    source_node = relationship("LayoutNode", foreign_keys=[source_id], back_populates="outgoing_connections")
    target_node = relationship("LayoutNode", foreign_keys=[target_id], back_populates="incoming_connections")
    
    def __repr__(self):
        return f"NodeConnection(id={self.id}, source={self.source_id}, target={self.target_id})"


class SimulationHistory(Base):
    """Records the history of simulations run on an organization layout"""
    __tablename__ = "simulation_history"
    
    id = Column(Integer, primary_key=True, index=True)
    layout_id = Column(Integer, ForeignKey("organization_layouts.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    simulation_data = Column(JSON, nullable=False)  # Store the simulation parameters
    results = Column(JSON, nullable=False)  # Store the simulation results
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    applied = Column(Boolean, default=False)  # Whether this simulation was applied to the actual layout
    
    # Relationships
    layout = relationship("OrganizationLayout", back_populates="simulations") 